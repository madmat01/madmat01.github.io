+++
title = "Diagnosing `ipCookieBindingError` in a Managed Production Environment"
date = 2026-07-01
draft = false
image = "/images/posts/Lever.png"
tags = ["PowerPlatform", "Security"]
+++

This post was written alongside Claude Opus 4.8 using a custom "My Voice" skill. Every word is checked and verified by me — but without Claude's help it wouldn't have got written, and I think being upfront about that matters. Here goes....

# Diagnosing `ipCookieBindingError` in a Managed Production Environment

## Overview

Users intermittently couldn't open a model-driven app in Production. Some could, some couldn't, and the pattern kept shifting. The root cause was **IP address-based cookie binding** terminating sessions when a user's egress IP changed mid-session — triggered by new office network infrastructure combined with hybrid working. Fix: disable the rule at the **Environment Group** level in Power Platform admin center. Environment-level toggle won't work if a group rule is enforcing it. This could be a problem for any rule in an Environment Group if you were to try and change a setting in a child Environment. 

## Symptoms

- Error screen: *"Your IP address has changed. Sign out and Sign in again to continue"*
- Error code: `ipCookieBindingError`
- Sign-in loop where the "Sign in to continue" modal reappears immediately after signing in
- Browser console: repeated `POST .../oauth2/v2.0/token 400 (Bad Request)` from MSAL silent refresh
- Affected users did **not** share the same security roles — the pattern was network-related, not permission-related

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/tocs1j268kg4dfkkwe9o.png)


## Why it started failing now

The rule was published in July 2025 and worked fine for months. What changed:

- New office network infrastructure, likely introducing multiple egress IPs (dual-WAN, SD-WAN, or a new NAT pool)
- Ongoing hybrid working — users moving between home and office
- Result: a single user session can traverse different public IPs during normal use. Each IP change invalidates the cookie

The feature is doing exactly what it's designed to do. It's just incompatible with a network where a user's IP isn't stable for the duration of a session.

## Diagnosis

### Step 1 — Identify the error

It looks fairly obvious what the culprit is from the error, but let's check the browser console on an affected user's machine. Look for:

- `ipCookieBindingError` in any visible error screen
- `POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token 400 (Bad Request)` in the Network tab
- MSAL errors around `acquireTokenByRefreshToken`

### Step 2 — Try to disable the setting in PPAC

The obvious thing to go and check here is the "Enable IP address based cookie binding" setting for the Environment.
Go to **Environments → [Our Environment] → Settings → Product → Privacy + Security** and toggle **Enable IP address based cookie binding** to Off. Save. - Done!

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/lz7x38yp1aataubp8u1a.png)



Except, we go to Toggle it to "Off", click Save, then it goes staight back to "On" again - Frustating! We can't just apply to the stereotypical Dad solution of spraying on a load of WD40 on this UI to fix this problem, oh no.

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/7hteaga67b4abp6f99ay.jpg)




### Step 3 — Confirm via the Dataverse Web API

Useful to get the real error message the UI swallows. PATCH the organisation record directly:

```powershell
$body = @{ enableipbasedcookiebinding = $false } | ConvertTo-Json
Invoke-RestMethod -Method Patch `
    -Uri "$OrgUrl/api/data/v9.2/organizations($OrgId)" `
    -Headers $headers `
    -Body $body
```

The response body gave the actual cause:

```json
{
  "error": {
    "code": "0x80098016",
    "message": "You can't change these settings because this environment is part of a group. If you're a tenant admin, modify the settings in the Environment Group."
  }
}
```

There we go - we have an answer: the setting is locked by an **Environment Group rule**, not by a permissions gap.

## Note on property naming

My first attempt used `isbasedonipcookiebinding` — wrong name, returned `0x80060888 Could not find a property`. The actual property is **`enableipbasedcookiebinding`**. To list the real property names on the organisation table:

```powershell
Invoke-RestMethod -Method Get `
    -Uri "$OrgUrl/api/data/v9.2/organizations($OrgId)" `
    -Headers $headers `
    | Select-Object -ExpandProperty PSObject `
    | Select-Object -ExpandProperty Properties `
    | Where-Object { $_.Name -match 'ip|cookie|firewall' }
```

## Resolution

Environment Group rules, once published, they **lock the corresponding setting** on every environment in the group. Local System Administrators can't override them. This is deliberate — it's how Microsoft implements tenant-scoped governance for managed environments. Per Microsoft Learn:

> *"When a rule is published at the Environment Group level, it's enforced across every environment within that group. This means the corresponding setting or policy becomes locked (read-only) within individual environments, ensuring that local system administrators can't modify or override these centrally defined rules."*
[MS LEarn - Environment Groups - Rules ](https://learn.microsoft.com/en-us/power-platform/admin/environment-groups#rules)

To change the rule you need **Power Platform Administrator** at tenant level.

### Steps

1. Sign in to [Power Platform admin center](https://admin.powerplatform.microsoft.com/) as a Power Platform tenant admin
2. **Manage → Environment Groups**

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/1gtktmo0z0s60oonk0sf.png)


3. Open the group Production belongs to
4. **Rules** tab → find **Enable IP Cookie Binding**
5. Open the rule → toggle **Enable IP address-based cookie binding** to Off
6. **Save**
7. **Publish rules** — this is the step that actually propagates the change. Unpublished changes don't apply

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/ptyi39gsabtmr71i348n.png)


8. Wait for propagation
9. Confirm on an affected user — the error should stop

## Follow-up — don't leave the security gap open

IP cookie binding was mitigating cookie replay attacks. Disabling it removes that control. Replace it with mechanisms that don't break on IP changes:

- **👮‍♀️Conditional Access in Entra ID** — sign-in frequency, compliant device requirement, trusted location policies. This is what Microsoft recommends as the primary mitigation for session hijacking in modern deployments. You should **turn this on** if it is not already.
- **👮‍♀️Session timeout and inactivity timeout** in Privacy + Security — bounded session lifetime without IP sensitivity

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/mgpjmd37bsas8kvp2ukq.png)


- **👮‍♀️IP firewall** (different from IP cookie binding) — blocks unknown IPs at the door rather than invalidating mid-session. Requires enumerating all legitimate egress IPs first though, not ideal for hybrid working.
- If IP cookie binding is genuinely required for compliance, revisit it after the network has stable, documented egress IPs, and populate the **👮‍♀️Reverse proxy IP addresses** field if reverse proxies are in scope for you organisation.

## Key takeaways

- **Silent toggle reversion in PPAC = Environment Group rule in effect.** No error message; the toggle just flips back. Check group membership first when an environment admin can't save a setting they should be able to.
- **Use the Dataverse Web API when the UI swallows errors.** PATCH the `organizations` record directly and read the response body — it helps you investigate and it gives you the actual reason.
- **`enableipbasedcookiebinding`** is the property name on the organisation table — not the one implied by the UI label
- **Environment Group rules require a tenant-level admin to modify.** System Administrator on the Dataverse side isn't enough
- **Publish rules** is a separate step from Save — rule changes don't propagate until published

## References

- [Safeguarding Dataverse sessions with IP cookie binding](https://learn.microsoft.com/power-platform/admin/block-cookie-replay-attack)
- [Environment Groups](https://learn.microsoft.com/power-platform/admin/environment-groups)
- [Rules for Environment Groups](https://learn.microsoft.com/power-platform/admin/environment-groups-rules)
- [Manage privacy and security settings](https://learn.microsoft.com/power-platform/admin/settings-privacy-security)