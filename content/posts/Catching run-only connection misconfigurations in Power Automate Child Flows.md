+++
title = "Catching run-only connection misconfigurations in Power Automate Child Flows"
date = 2026-07-01
draft = false
image = "/images/posts/sniper.png"
tags = ["PowerPlatform", "DevOps", "PowerAutomate", "automation"]
+++

This post was written alongside Claude Opus 4.8 using a custom "My Voice" skill. Every word is checked and verified by me — but without Claude's help it wouldn't have got written, and I think being upfront about that matters. Here goes.

You've just deployed an approval solution to UAT. The pipeline ran clean — export, unpack, solution checker, artifact published. Everything green.

Then you notice a Child Flow is off 😡.

Not erroring. Not failing. Just off — sitting there in a turned-off state as if it never wanted to run.

## The problem hiding in plain sight

The culprit, when you eventually find it, is a Teams connector (or any connector. Sometimes all you need to do is look at the Power Automate Flow Designer on a Child Flow and the default connection setting is changed to **Provided by run-only user**. This means the Flow expects whoever is invoking it to supply their own connection at runtime.

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/qa23qwe30xj93hhmvi8v.png)


That's fine for Flows a person runs manually. It's a real pain for Child Flows called by a service account.

When the Child Flow is invoked by a Parent Flow running under a service account — which has no Connection of its own — the Flow can't start. Power Platform's response to this isn't to error loudly. It deploys the Flow in a disabled state and leaves you to figure out why.

The part that stings is that nothing in your pipeline catches this. The solution exports without complaint. The solution checker raises no warnings. The build passes. The misconfiguration travels all the way from your development environment to UAT before anyone notices.
![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/r1meptvowhqljo0w2lcx.png)
```plaintext
The workflow with id '7a2b9d5c-e4f1-4328-b1a9-d8e7c6b5a413', name [child] - MyFlow cannot be used as a child workflow because child workflows only support embedded connections.

```

## The fix is easy — once you find the problem

In the source environment, open the Child Flow, find the Teams connector, and change the connection setting from **Provided by run-only user** to **Use this connection** (the service account's connection). Save the Flow, re-export, and re-run the pipeline.

Two minutes of work, once you know where to look.

The issue isn't fixing it. The issue is finding it — and finding it after it's already deployed somewhere means you're fixing a target environment instead of fixing source control. That's the wrong direction for ALM.

## Catching it in the Build Pipeline

When Power Platform Build Tools unpacks a solution, the workFlow JSON files land on disk. Each one contains the Flow's full definition — triggers, actions, connection references — readable as plain JSON.

The connection setting that causes the problem shows up in `properties.connectionReferences`. For most connectors it appears as `runtimeSource: "invoker"` or `providedByRunOnlyUser: true`. The Dataverse connector stores it differently — as `impersonation: { source: "invoker" }` with `runtimeSource` still set to `"embedded"`. Either way, it's right there in the file. We just need something to look for it before the artifact gets published.

The script below does exactly that. It runs after the Unpack step, scans every workFlow JSON file, and fails the build immediately if it finds a Child Flow with a run-only connection.

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/gtvu3doe3ga964r3eyy7.png)



## Three things that together mean trouble

Before looking at the script, it's worth understanding what it's looking for — because not every Flow with a run-only connection is necessarily a problem. It only matters for Child Flows.

The script identifies Child Flows by looking for two things together: a `manual` trigger (the internal name for the **When an HTTP request is received** trigger that Child Flows use), and a `Response` action somewhere in the action tree. A Flow with both is almost certainly designed to be called by a Parent Flow and return a result. That's the Flow where a run-only connection will silently break things at deployment.

## The script

```powershell
# ============================================================
# Check-ChildFlowRunOnlyConnections
# Fails the build if any Child Flow in the solution uses
# run-only / invoker connections.
# ============================================================

$UnpackRoot = "$(Build.SourcesDirectory)\$(SolutionName)\managed"
$ErrorFound = $false

if (-not (Test-Path $UnpackRoot)) {
    Write-Host "##vso[task.logissue type=error]Unpack root not found at: $UnpackRoot"
    Write-Host "##vso[task.complete result=Failed;]Cannot locate unpacked solution."
    exit 1
}

$WorkFlowsRoot = Join-Path $UnpackRoot 'WorkFlows'

if (-not (Test-Path $WorkFlowsRoot)) {
    Write-Host "No WorkFlows folder found in solution — nothing to check."
    exit 0
}

function Find-ResponseAction {
    param ([Parameter(Mandatory)] $Actions)
    if (-not $Actions) { return $false }

    foreach ($a in $Actions.PSObject.Properties) {
        if ($a.Value.type -eq 'Response') { return $true }

        foreach ($branch in @('actions', 'else', 'default')) {
            if ($a.Value.$branch -and (Find-ResponseAction $a.Value.$branch)) {
                return $true
            }
        }

        if ($a.Value.cases) {
            foreach ($case in $a.Value.cases.PSObject.Properties) {
                if ($case.Value.actions -and (Find-ResponseAction $case.Value.actions)) {
                    return $true
                }
            }
        }
    }
    return $false
}

$wfFiles = Get-ChildItem -Path $WorkFlowsRoot -Recurse -Filter '*.json' -ErrorAction SilentlyContinue

if (-not $wfFiles) {
    Write-Host "No workFlow JSON files found — nothing to check."
    exit 0
}

foreach ($f in $wfFiles) {

    try {
        $wf = Get-Content $f.FullName -Raw | ConvertFrom-Json
    }
    catch {
        Write-Host "##vso[task.logissue type=warning]Could not parse: $($f.FullName)"
        continue
    }

    # CORRECT PATHS — properties.definition and properties.connectionReferences
    $props = $wf.properties
    if (-not $props) { continue }

    $triggers = $props.definition.triggers
    $actions  = $props.definition.actions

    $hasManual = ($triggers -and $triggers.PSObject.Properties.Name -contains 'manual')
    if (-not $hasManual) { continue }

    $hasResponse = Find-ResponseAction $actions
    if (-not $hasResponse) { continue }

    $badRefs  = @()
    $connRefs = $props.connectionReferences

    if ($connRefs) {
        foreach ($p in $connRefs.PSObject.Properties) {
            $cr = $p.Value
            $isRunOnly = ($cr.runtimeSource -eq 'invoker') -or
                         ($cr.runtimeSource -eq 'Invoker') -or
                         ($cr.providedByRunOnlyUser -eq $true) -or
                         ($cr.authenticationType -eq 'Invoker') -or
                         ($cr.impersonation.source -ieq 'invoker')
            if ($isRunOnly) {
                $badRefs += [PSCustomObject]@{
                    Name                  = $p.Name
                    runtimeSource         = $cr.runtimeSource
                    providedByRunOnlyUser = $cr.providedByRunOnlyUser
                    authenticationType    = $cr.authenticationType
                    impersonationSource   = $cr.impersonation.source
                }
            }
        }
    }

    if ($badRefs.Count -gt 0) {
        $displayName = $props.displayName
        if (-not $displayName) { $displayName = $f.Name }

        Write-Host "##vso[task.logissue type=error]Child Flow '$displayName' has run-only/invoker connection(s) — $($f.FullName)"
        foreach ($ref in $badRefs) {
            $detail = "  Connection ref: '$($ref.Name)' | runtimeSource=$($ref.runtimeSource) | providedByRunOnlyUser=$($ref.providedByRunOnlyUser) | authenticationType=$($ref.authenticationType) | impersonationSource=$($ref.impersonationSource)"
            Write-Host "##vso[task.logissue type=error]$detail"
        }
        $ErrorFound = $true
    }
}

if ($ErrorFound) {
    Write-Host "##vso[task.complete result=Failed;]One or more Child Flows use run-only/invoker connections. Fix in the source environment before re-running."
    exit 1
}

Write-Host "Check passed — no run-only/invoker connections found in Child Flows."
```

## Where it goes

Place it after the **Unpack Solution** task and before artifact publishing. It needs the workFlow JSON files on disk, and it should block the pipeline before anything gets committed or deployed downstream.

The script uses ADO inline variable syntax — `$(Build.SourcesDirectory)` and `$(SolutionName)` — which means it must run as an inline script rather than a file reference. Paste the content directly into your pipeline YAML:

```yaml
- task: PowerShell@2
  displayName: 'Fail if Child Flows use run-only/invoker connections'
  inputs:
    targetType: inline
    script: |
      # paste script content here
```

`SolutionName` needs to be defined as a pipeline variable in your variable group or `variables:` block.

## What the failure looks like

When the script finds a problem, it writes directly to the ADO build summary:

```console
##[error]Child Flow 'child-MyFlow-7a2b9d5c-e4f1-4328-b1a9-d8e7c6b5a413' has run-only/invoker connection(s)
##[error]  Connection ref: 'shared_teams-1' | runtimeSource=invoker | providedByRunOnlyUser= | authenticationType= | impersonationSource=
```

For a Dataverse connector set to "Provided by run-only user" the output looks slightly different — `runtimeSource` stays `embedded` but `impersonationSource` is populated:

```console
##[error]Child Flow 'child-MyFlow-7a2b9d5c-e4f1-4328-b1a9-d8e7c6b5a413' has run-only/invoker connection(s)
##[error]  Connection ref: 'shared_commondataserviceforapps' | runtimeSource=embedded | providedByRunOnlyUser= | authenticationType= | impersonationSource=invoker
```

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/mdiowf0b7h233egw3zft.png)



It names the Flow and the specific connection reference. No ambiguity about what needs fixing.

## Fixing it

When the build fails:

1. Go to [make.powerautomate.com](https://make.powerautomate.com) and switch to the **source environment**
2. Open the flagged Child Flow for editing
3. Find the connector named in the error — change its connection setting from **Provided by run-only user** to **Use this connection**, selecting the service account's connection
4. Save the Flow
5. Re-export the solution and re-run the pipeline

The fix takes two minutes. The important thing is where it happens — in the source environment, in the Flow definition, before anything is deployed.

## The difference it makes

Before: a Teams connector left on the wrong setting ships to UAT or even Production, the Flow is disabled, someone spends time hunting the cause, and the fix happens in a target environment instead of source control.

After: the pipeline stops at the gate, the error names the Flow and the connector, the developer fixes it in the source environment and re-runs. The misconfiguration never reaches UAT.

One less thing that only breaks in the wrong place 🙂.
