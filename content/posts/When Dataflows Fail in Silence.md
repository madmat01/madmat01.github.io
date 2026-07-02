+++
title = "When Dataflows Fail in Silence"
date = 2026-07-01
draft = false
image = "/images/posts/sleeping-dataflows.png"
tags = ["PowerPlatform", "Database", "PowerAutomate"]
+++

This post was written alongside Claude Opus 4.8 using a custom "My Voice" skill. Every word is checked and verified by me — but without Claude's help it wouldn't have got written, and I think being upfront about that matters. Here goes.

# When Dataflows Fail in Silence

Your service account runs dataflows overnight. The refresh finishes, or it doesn't — and either way, nobody knows. There's no inbox, no owner, no alert. The data is stale and the business won't find out until someone runs a report and the numbers look wrong.

This is a solved problem, but it requires a bit of deliberate plumbing. Here's the Power Automate flow I built to catch failed dataflow refreshes and surface them to the team before anyone notices.

---

## The Setup

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/5wy5nzxfwdhkr4h4axus.png)


The flow runs on a recurrence trigger — every day of the week at 00:00 GMT. There's no native Power Automate trigger for dataflow refresh failures, so a scheduled poll is the right approach here. Midnight is a deliberate choice: by running at the start of a new day, the flow captures the full previous day's refresh history before anyone starts work.

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/2unp0hbiuwfw5rex7129.png)


The flow itself has three logical steps: query Dataverse for yesterday's failures, check if any exist, and if so — send a formatted email.

---

## Querying the Right Table

Power Platform stores dataflow refresh history in the `msdyn_dataflowrefreshhistories` Dataverse table. It's not one that comes up often, but it has everything you need: the dataflow name, refresh end time, status, and a JSON blob containing the error detail.

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/xptmvsde78p9qw1ouf2f.png)


The **List rows** action queries this table using FetchXML:

```xml
<fetch>
  <entity name="msdyn_dataflowrefreshhistory">
    <attribute name="msdyn_dataflowrefreshhistoryid" />
    <attribute name="msdyn_endtime" />
    <attribute name="msdyn_refreshstatus" />
    <attribute name="msdyn_errorinfojson" />
    <attribute name="msdyn_dataflowid" />
    <attribute name="msdyn_dataflowname" />
    <filter type="and">
      <condition attribute="msdyn_endtime" operator="yesterday" />
      <condition attribute="msdyn_refreshstatus" operator="eq" value="Failed" />
    </filter>
  </entity>
</fetch>
```

FetchXML is the right choice here because date operators like `yesterday` aren't available in standard OData filtering — you'd have to calculate and pass a UTC date string, which gets messy. FetchXML handles it cleanly.

The filter returns only records where the refresh ended yesterday with a `Failed` status. Clean days return nothing.

---

## Only Send When There's Something to Say

Before building the email, the flow checks whether the query returned any rows:

```plaintext
equals(empty(outputs('List_rows_...')?['body/value']), false)
```

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/hx45ktzql2niobuaqf5g.png)


If the array is empty — no failures yesterday — the flow does nothing. No email, no noise. The team only hears about this flow when it matters.

---

## Shaping the Data for Humans

When there are failures, a **Select** action maps the raw Dataverse columns into something readable:

| Column | Expression |
|---|---|
| Name | `item()?['msdyn_dataflowname']` |
| End Time | `formatDateTime(item()?['msdyn_endtime'], 'MMM dd, yyyy hh:mm tt')` |
| Dataflow ID | `item()?['msdyn_dataflowid']` |
| Error Message | `json(item()?['msdyn_errorinfojson'])?['ErrorMessage']` |
| Error Code | `json(item()?['msdyn_errorinfojson'])?['ErrorCode']` |

The `msdyn_errorinfojson` field is a raw JSON string. Wrapping it in `json()` and extracting `ErrorMessage` and `ErrorCode` gives the reader the two things they actually need to diagnose what went wrong — without having to go and look it up manually.

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/zxhmal397me80gz5cehw.png)


From there, **Create HTML table** converts the selected rows into a table, and a **Compose** action injects CSS to make it readable in an email client:

```html
<style>
  table { border-collapse: collapse; }
  table td, table th { border: 1px solid #AAAAAA; padding: 3px 10px; }
  table tr:nth-child(even) { background: #D9E1F2; }
  table thead { background: #4472C4; }
  table thead th { font-size: 15px; font-weight: bold; color: #FFFFFF; text-align: left; }
</style>
```

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/awz0khw4yqp7ajbbkd10.png)


Basic — but it renders a legible, scannable table in Outlook without any additional tooling.

---

## The Email Goes to Support Desk, Not an Inbox

The **Send an email (V2)** action sends to `support@mycompany.com`. This isn't an accident.

Sending to a shared inbox means the email sits there until someone acts on it — or doesn't. Sending to the support Desk creates a support ticket automatically, which means:

- The failure is tracked
- It gets assigned
- There's an audit trail
- It won't be quietly read and forgotten

The email body includes a direct link to the dataflows list in the production environment and a link back to the flow itself — so the person picking up the ticket can get to the right place in one click.

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/l56tc7fqtbl0bus79ksb.png)


---

## Known Gaps

This flow does the job, but it's not perfect. Worth being honest about the tradeoffs.

**Failures are reported the morning after, not the same day.** Running at midnight with `operator="yesterday"` means the team won't see a ticket until they start work the following day. For most reporting and ETL scenarios that's acceptable — but if a dataflow feeds something time-sensitive, you'd want a more frequent check using a rolling `last-x-hours` window instead.

**Null error JSON will crash the Select.** If any refresh history row has a null or malformed `msdyn_errorinfojson`, the `json()` expression throws and the entire Select action fails — no email goes out. Wrapping it in a null check would make it more resilient:

```plaintext
if(empty(item()?['msdyn_errorinfojson']), 'N/A', json(item()?['msdyn_errorinfojson'])?['ErrorMessage'])
```

**Multiple failures per dataflow produce multiple rows.** If a dataflow is configured to refresh twice a day and fails both times, it appears as two rows. This is arguably correct behaviour, but worth being aware of.

---

Visibility is the feature. The dataflows were always going to fail occasionally — that's not the problem. The problem was that nobody would find out. This flow makes the failure loud, routes it to a system that tracks it, and gives the person picking it up everything they need to act.

The gaps are real, but the alternative — checking manually or finding out from a user — is worse.
