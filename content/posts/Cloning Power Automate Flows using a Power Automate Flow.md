+++
title = "Cloning Power Automate Flows using a Power Automate Flow"
date = 2026-04-16
draft = false
tags = ["Power Automate", "Power Platform", "Cloud Flows", "Automation", "Dataverse"]
+++

## Introduction

When you build a document trigger on top of SharePoint, you quickly run into a fundamental constraint: **a SharePoint trigger Flow is hardwired to a single Site and Library**. There is no native way to point one Flow at a dynamic or configurable location — the Site URL and Library GUID are baked into the trigger definition at creation time.

For a one-off deployment that's fine. But when you're setting up a standardised **Processes & Procedures ** programme across an organisation — where every Team or Business unit gets its own SharePoint Site — you need an approval trigger Flow for *each* one. Creating and maintaining these by hand rapidly becomes a maintenance problem: if you fix a bug in one, you have to fix it in all of them.

This post walks through the solution we built to address that: a **Site-specific Provisioning Flow** that clones a template approval trigger into a new, Site-specific Flow automatically, using nothing more than Dataverse, Power Automate, and a clean separation between configuration data and Flow logic.

---

## The SPO P&P System at a Glance

Before diving into the provisioning Flow, it's worth establishing the wider architecture of the solution.

Each Processes and & Procedures Library is in a SharePoint Site. Authors upload documents to the Library. When a document is submitted for approval (its approval status set to *Pending Approval*), a Power Automate Flow fires, routes the approval through a standard and centralised process via Microsoft Teams, and on Approval publishes the document to its major version and updates the approval metadata. This process can be maintained and changed whenever required and is all done in one place. 

That last Flow, the one watching the Library for changes, is the one we need to clone. It is specific to a Site and Library. The goal of this project was to make provisioning a new P&P Site a self-service operation: an admin fills in a record, runs a Flow from the Model Driven app, and everything wires itself up automatically 😀.


![Screenshot: SPO P&P Admin Model Driven App — Site Registries list view](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/9z5yln8nfnf5a014lwjf.png)

---

## The Three Flows

The solution contains three Power Automate Flows that work together:

| Flow | Role |
|---|---|
| **SPO PP - Provision Site Flow** | Orchestrator — clones the template and provisions a new Site-specific Flow |
| **SPO PP - Approval Trigger - TEMPLATE** | Template — the Flow definition that gets cloned for each new Site |
| **Child: PP Approval Standard Process** | Worker — handles the actual approval logic, called by every cloned trigger Flow |

The template and child Flows are permanent, shared fixtures. The cloned approval trigger Flows are ephemeral — one per Site, generated at provisioning time. We can have as many as we want of these, but point them all to the same child Power Automate Flow so we can control the centralised process in one place.

![Diagram: Relationship between the three Flows](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/ug16ax4y3wxsmthetufk.png)

---

## The Site Registry Table

The hub of the whole system is a custom Dataverse table: **`Site_Registry`** . It stores one row per P&P Site and acts as the source of truth for both provisioning and ongoing operations.

### Custom Columns

| Display Name | Logical Name | Type | Required | Purpose |
|---|---|---|---|---|
| **Site Name** | `Sitename` | Text  | Yes | Human-readable name; also used as the Primary Name field and in the provisioned Flow's display name |
| **Site URL** | `Siteurl` | Text  | Yes | Full URL of the SharePoint Site (e.g. `https://companySite.sharepoint.com/Sites/Finance`) |
| **Library GUID** | `Libraryguid` | Text | Yes | GUID of the Document Library within the Site — required by the SharePoint trigger |
| **Flow ID** | `Flowid` | Text | No | Written back by the provision Flow after cloning; links this registry entry to its live approval trigger Flow |
| **Site Registry ID** | `Site_Registryid` | GUID (Primary Key) | System | Auto-generated unique identifier for the row |

The `Flowid` column starts empty. It is the only field the provisioning process writes — everything else is entered by the admin before triggering provisioning.

### Why Library GUID, Not Library Name?

The SharePoint `When a file is created or modified (properties only)` trigger requires a list/Library GUID rather than its display name. GUIDs are stable across renames and don't break if someone tidies up the Library name. Recording the GUID in the Site Registry means provisioning is reliable regardless of what the Library is called. For our template, we can just use a development SharePoint site and a placeholder document Library to keep things simple and standard. I had tried inserting `placeholderName` and `Library-guid-name` as placeholders, but the Flow struggled to save. 
As a possible improvement in the Model Driven App, we could make selection easier by showing them a list of possible document libraries for the selected sites, so the user does not have to go and find the GUID. 

![Screenshot: Site Registry form in the Model Driven App — showing all custom columns](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/9kkprsra65gimikc4ovl.png)

---

## The Approval Trigger Template

The template Flow (`SPOPP-ApprovalTrigger-TEMPLATE`) is the blueprint for every Site-specific approval trigger. It lives in the solution and is **never activated** — it exists solely to be cloned.

Its trigger is a SharePoint `When a file is created or modified (properties only)` action polling every 1 minute, pointed at two placeholders:

- **Site URL placeholder:** `https://companysite.sharepoint.com/Sites/ITDevelopment`
- **Library GUID placeholder:** `a3f7c291-84e6-4d1a-b509-2e763dc18f45`

A trigger condition filters the events down to only relevant ones:

```plaintext
ApprovalStatus = 3 (Pending Approval)
AND Editor is NOT the service account  
```

This prevents the Flow from firing on system-generated updates and ensures it only acts when a real user has submitted a document for review.

When the trigger fires, the Flow calls a single action inside a Try scope: **Run a Child Flow — PP Approval Standard Process**. It passes the item's ID, Site URL, Library GUID, author claims, full path, approval status, and editor claims to the child Flow, then waits for a response.

The Catch scope sends an error notification email to the support desk if anything fails.

![Screenshot: Template Flow overview in Power Automate designer](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/ixcz0r9400ubje6h654g.png)

### The `clientdata` Column — the Key to Cloning

When Power Automate stores a Flow in Dataverse, it uses the `workFlows` ("Processes") table. The Flow's entire definition — triggers, actions, connections, expressions — is serialised as JSON and stored in a column called **`clientdata`**.

This is the column we read from the template and write to the new Flow. The string-replace approach works because the placeholders (the hardcoded Site URL and Library GUID) are literal strings embedded in that JSON. Swapping them out produces a valid, Site-specific Flow definition ready to run.

![Screenshot: workFlows table row for the template, showing clientdata column in Dataverse](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/47iz52xwmvr78y88siaz.png)

---

## The Provision Site Flow — Step by Step

The **SPO PP - Provision Site Flow** is triggered from the Model Driven App by an admin selecting a Site Registry row and running the Flow from the command bar.

![Trigger the Flow for a Site and Library](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/cklzky6h792c3mq1qsl2.png)

```plaintext
Trigger: Record Selected on Site_registries
```

The trigger uses `splitOn`, meaning if multiple rows are selected the Flow runs once per row — each Site is provisioned independently.

![Screenshot: Provision Site Flow — full overview in Power Automate designer](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/94lcjkdw0i599smlgzca.png)
---

### Step 1 — Initialise Variable (`varClientData`)

Before entering the Try scope, a string variable `varClientData` is initialised empty. This will hold the cloned Flow definition once the placeholders have been replaced.

This is declared outside the Try scope deliberately: it needs to be initialised before any branching logic, and the scoped Try/Catch pattern requires variables to be declared at the root level to be accessible in both branches.

---

### Step 2 — Get Site Registry Row (`Get a row by ID — Site Registry from Trigger`)

The trigger provides the `Site_Registryid` from the selected record, but only the ID and Site name are included in the trigger payload. We need the full row — specifically the `Siteurl` and `Libraryguid` — so the first action inside the Try scope fetches it.

```plaintext
Entity: Site_registries
Record ID: triggerBody()?['entity']?['Site_Registryid']
```

The output of this action is referenced throughout the rest of the Flow.

![Screenshot: Get a row by ID action — Site Registry](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/dkmovi5xev2sb892j9hg.png)

---

### Step 3 — Retrieve the Template Flow Definition (`List rows — Processes`)

Next, the Flow queries the Dataverse `workFlows` ("Processes") table to retrieve the template's `clientdata`:

```sql
Entity: workFlows
$select: clientdata, workFlowid
$filter: workFlowid eq '05a1a909-5b33-f111-88b3-6045bddd6b33'
$top: 1
```

The template's workFlow ID is hardcoded here — it is a known, stable fixture in the solution. Using `$top: 1` ensures a single result is returned efficiently.

The `clientdata` that comes back is the full JSON definition of the template Flow, including the hardcoded Site URL and Library GUID placeholders.

![Screenshot: List rows action — retrieving template clientdata from workFlows table](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/afdgc0inkot5fu7vyjlc.png)

---

### Step 4 — Inject Real Values (`Set variable — varClientData`)

This is the core of the cloning mechanism. A double-nested `replace()` expression swaps out both placeholders in a single operation:

```javascript
replace(
  replace(
    first(outputs('List_rows_-_Processes')?['body/value'])?['clientdata'],
    'https://companySite.sharepoint.com/Sites/ITDevelopment',
    outputs('Get_a_row_by_ID_-_Site_Registry_from_Trigger')?['body/Siteurl']
  ),
  'a3f7c291-84e6-4d1a-b509-2e763dc18f45',
  outputs('Get_a_row_by_ID_-_Site_Registry_from_Trigger')?['body/Libraryguid']
)
```

The inner `replace` substitutes the Site URL. The outer `replace` then takes that result and substitutes the Library GUID. The outcome is stored in `varClientData`: a complete, valid Flow definition targeting the new Site's Library.

No parsing, no schema manipulation — just string replacement in JSON.

![Screenshot: Set variable action — showing the double replace expression](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/20oquqth4p8f7m8upm94.png)

---

### Step 5 — Create the New Flow (`Add a new row — Processes`)

The modified definition is now written back to the `workFlows` ("Processes") table as a new row, creating the cloned Flow:

```yaml
Entity: workFlows
item/name:     "SPO PP - Approval Trigger - {Sitename}"
item/category: 5        (Modern Flow)
item/type:     1        (Definition)
item/primaryentity: "none"
item/xaml:     " "     (required field, but not used for modern Flows)
item/clientdata: @variables('varClientData')
```

The `category: 5` value identifies this as a cloud Flow. The `xaml` field is a legacy artefact required by the API but irrelevant for modern Flows apparently — a single space " " keeps it happy.

The response from this action includes the new Flow's `workFlowid`, which is carried forward to the next two steps.

The new Flow is created in a **disabled/draft state**. It will not run until it is manually opened, saved (to authenticate connections), and turned on. This is by design — connections must be authorised by a human with the appropriate permissions, not ideal for automations, but we can live with it.

![Screenshot: Add a new row action — creating the cloned workFlow in Dataverse](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/mx3cztsc3m03jwjs00gh.png)

---

### Step 6 — Add to Solution (`Perform an unbound action — Add to Solution`)

With the Flow created, it exists in Dataverse but is not yet part of any solution. This step calls the `AddSolutionComponent` unbound action to register it under the `SPOPPSiteConfig` solution:

```yaml
ComponentId:         (new Flow's workFlowid)
ComponentType:       29    (Cloud Flow)
SolutionUniqueName:  SPOPPSiteConfig
AddRequiredComponents: false
DoNotIncludeSubcomponents: false
```

Component type `29` maps to cloud Flows in the Dataverse component type enumeration. By adding it to the solution, the provisioned Flow becomes visible in the main solution and is logically grouped with the rest of the P&P components - making management cleaner.

![Screenshot: Perform unbound action — AddSolutionComponent](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/f3owyxvtdn9ygi2wpnaz.png)

---

### Step 7 — Write the Flow ID Back to Site Registry (`Update a row — Site Registry`)

The final Dataverse write closes the loop: the new Flow's ID is written back to the Site Registry record that triggered this whole process. This is for record keeping maintenance mainly. As an added extra you could concatenate the full URL for the Flow if you wanted to.

```plaintext
Entity: Site_registries
Record ID: triggerBody()?['entity']['Site_Registryid']
Flowid: outputs('Add_a_new_row_-_Processes')?['body/workFlowid']
```

After this step, the Site Registry row has a `Flow ID` value. This serves as:
- A human-readable audit trail (the admin can see which Flow was provisioned for which Site)
- A navigation link back to the provisioned Flow
- A signal that provisioning has completed for this Site

![Screenshot: Update a row action — writing the Flow ID back to Site Registry](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/ea3yr72bn16w4v7k1xzo.png)

---

### Step 8 — Notify via Teams Adaptive Card (`Post card — Turn Flow On`)

The final action sends an Adaptive Card to the user who triggered the Flow via Teams (the `triggerOutputs()?['headers']['x-ms-user-email']` header on the trigger response identifies them):

![Screenshot: Adaptive Card in Teams — SPO P&P Flow Provisioning notification]
![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/ww990b6ipx6dsfu2p5er.png)

As mentioned earlier, I tried to use some Power Automate actions to Turn On the Flow, But couldn't find any that worked, so this is our only workaround and a quick step for the end user, although not ideal. If you know a way to easily do this, please leave a comment. 

The card surfaces:

- **Completed automatically:** a green checklist of everything the Flow did
- **Manual activation required:** a warning block explaining the three steps the admin must take
- **Open Flow button:** a direct link to the new Flow in the Power Automate portal

The three manual steps are:

1. Open the Flow via the link in the card
2. Click **Turn on**

This manual step is a conscious design decision. Power Automate does not permit programmatic activation of a Flow that has connection references requiring user consent — the connections must be authorised interactively. The card makes this as frictionless as possible.

---

### Error Handling — Scope Catch

If any action inside the Try scope fails, times out, or is skipped, the Catch scope runs. It:

1. Filters `result('Scope_-_Try')` to find the actions that failed, timed out, or were skipped
2. Posts a plain Teams message to the triggering user with a direct link to the failed Flow run

```plaintext
❌ Provision Site Flow Failed
Site: {Sitename}
View Flow Run: [link]
Once resolved, re-trigger provisioning from the SPO P&P Administration app.
```

The admin can inspect the failed run, resolve the root cause, and re-trigger provisioning from the app. Because the Site Registry record is only updated in Step 7 (after everything else succeeds), a partial failure leaves the record in its original state — `Flow ID` will be blank, signalling that provisioning is incomplete and can safely be re-run.

![Screenshot: Catch scope — Teams error message action](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/fuet0dyeb11dxfm5f97q.png)

---

## The Child Approval Flow

This is the central Flow that the cloned trigger Flows hand off to. The team can iterate on this particular Flow / Process as much as is needed without having to worry about duplicate actions, etc., as the Process can be amended when needed. 

The **Child: PP Approval Standard Process** is a manually-triggered child Flow that accepts seven parameters from every approval trigger:

| Parameter | Description |
|---|---|
| `ItemID` | SharePoint list item ID |
| `SiteURL` | URL of the Site (passed through, not hardcoded) |
| `ListGUID` | Library GUID (passed through) |
| `AuthorClaims` | Claims string of the document author |
| `FullPath` | Server-relative path of the document |
| `ApprovalStatus` | Numeric approval status value from SharePoint |
| `Editor` | Claims string of the last editor |

On receipt, it:

1. Checks the item isn't already approved (terminates gracefully if it is)
2. Builds the server-relative URL via a `Compose` expression
3. Calls the SharePoint REST API to **publish** the document (`_api/web/GetFileByServerRelativeUrl(...)/Publish`)
4. Reads the updated file properties back from SharePoint
5. Calls the SharePoint REST API to **set the approval status**  to Approved (`OData__ModerationStatus: 0`) and records the approval date and updates any other column metadata required.
6. Posts a Teams message to the document author confirming approval and the new version number

Because the Site URL and Library GUID are passed in as parameters (not hardcoded), this single child Flow serves every cloned approval trigger across the entire organisation.

---

## How It All Fits Together

Here's the end-to-end lifecycle for adding a new P&P Site to the system:

```plaintext
1. Admin creates a SharePoint Online Site and Document Library
2. Admin notes the Library GUID (from the SharePoint URL or list settings)
3. Admin opens the SPO P&P Administration app
4. Admin creates a new Site Registry row:
      Site Name:    "Finance"
      Site URL:     https://companysite.sharepoint.com/Sites/Finance
      Library GUID: [GUID from SharePoint]
5. Admin selects the row and runs "SPO PP - Provision Site Flow" from the command bar
6. Flow runs (~10 seconds):
      - Reads Site Registry row
      - Fetches template clientdata from Dataverse
      - Replaces Site URL and Library GUID placeholders
      - Creates new Flow: "SPO PP - Approval Trigger - Finance"
      - Adds Flow to SPOPPSiteConfig solution
      - Writes Flow ID back to Site Registry
      - Sends Adaptive Card to The user that initiated the process via Teams
7. Admin clicks "Open Flow" in the Teams card
8. Admin saves and turns on the Flow
9. Finance P&P Site is live — approval triggers are active
```

From step 4 to a live Flow takes under a minute of admin time, with no Flow editing or cloning required.

---

## Key Design Decisions

**Why string replacement instead of a proper API?**  
Power Automate does not expose a public API for cloning Flows. The `clientdata` approach is the only programmatic path available without leaving the Power Platform. It is undocumented but stable — Microsoft's own import/export tooling uses the same `workFlows` ("Processes")("Processes") table and `clientdata` column.

**Why store Library GUID and not Library Name?**  
GUIDs are immutable. Library names can be changed by Site owners without affecting the trigger. Storing the GUID avoids a class of hard-to-diagnose breakages.

**Why manual activation?**  
Connection references in Power Automate require user consent. There is no API to activate a Flow with unauthenticated connection references. The Adaptive Card makes the manual step as lightweight as possible.

**Why add the Flow to the solution?**  
It keeps all provisioned Flows grouped under `SPOPPSiteConfig` in the environment. This makes bulk management, export, and environment promotion practical — rather than having dozens of orphaned Flows scattered across the default solution.

**Environment Constraint: Unmanaged Required**
⚠️ One big constraint worth flagging: the Environment where the provisioned flows are created must be **unmanaged**.
The cloning mechanism writes new rows directly to the workflows table at runtime. Those flows are unmanaged artefacts — they exist outside the solution package and outside the ALM pipeline. That is intentional; they are site-specific, runtime-generated, and self-service by design.
But it means a managed-solution environment is incompatible with this pattern. The provisioning Flow will run fine as a managed component, but the governance model of a managed environment conflicts with generating unmanaged Flow records inside it.

The default environment is the most common candidate simply because it is typically unmanaged — but the constraint is unmanaged vs. managed, not default vs. non-default. Any unmanaged environment works.

---

## Summary

The project is delivered a self-service Site provisioning capability built on a single mechanism: reading a Flow's `clientdata` from Dataverse, replacing two placeholder strings, and writing the result back as a new workFlow row. The Site Registry table is the operational hub — it drives provisioning and records the outcome. The template Flow is the blueprint — stable, never activated, just there to be cloned.

The result is a system where adding a new P&P Site is a data entry task, not a development task.
