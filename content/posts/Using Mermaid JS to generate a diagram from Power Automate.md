+++
title = "Using Mermaid JS to generate a diagram from Power Automate"
date = 2024-02-20
draft = true
tags = ["Mermaid JS", "Power Automate", "Documentation", "Diagrams", "Markdown", "Automation"]
+++

###Introduction
This is the "bonus part" of my blog series on 
[creating a Conversational Approval Process using Power Automate and Microsoft Teams.](https://dev.to/mcombp/conversational-approval-process-using-adaptive-cards-and-json-objects-4mih)

I needed a way to produce an easy to read depiction of the steps of a process to users or even a way to debug what happened. After seeing Jon Russell and Mike Gowland's amazing demo of
**JustAskIt** on a [Microsoft 365 & Power Platform Development community call](https://youtu.be/yderRfy2wWA?si=gi11PmzVnYzyI_DP&t=3344) I have been keen to try out Mermaid JS in Power Automate.

### What is Mermaid JS?
Mermaid JS is a tool that lets you create diagrams and charts such as flowcharts, sequence diagrams, Gantt charts using simple text commands. It works by converting your text commands into a graphical representation that you can customize and share.
[https://mermaid.live/](https://mermaid.live/)

### Example 
Using Mermaid JS we easily can convert Markdown like this:
```
flowchart TD
    A[Christmas] -->|Get money| B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
    C -->|Three| F[fa:fa-car Car]
  
```
into an image like this that lists the steps in an easy to read graphical format:
![Mermaid Example](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/i4ibxk4m1ifw0bw156nf.png)

## Building the Flow

### Manual Trigger 
We start off our Flow with the manual trigger. The first text input is **varSteps**, this is the steps that we are going to either create or append to our existing Flowchart.
The other text input is the Flowchart, so this is where we could insert an existing Flowchart to our Power Automate Flow. 

![Manual Trigger](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/5inkmqwjnnhvklegv7is.png)

### Alphabets Variable
The first variable to initialise is Alphabets, here we will have a string value of the 26 character alphabet. We will use this to pick out the next alphabetical character if we need to append to an existing Flowchart. 
![Alphabets Variable](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/xw8tw1umoooxjavqvkaz.png)

### Flowchart Variable
The next variable to initialise is Flowchart, which is a string variable that will capture the Flowchart text input from the manual trigger. 

![Flowchart Variable](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/qz95zy37uiofpxtsogu5.png)

### varSteps Variable
Then the next variable to initialise is the **varSteps**, which is an object variable. It will capture the text input for **varSteps** from the manual input, but we will wrap this inside JSON() so that it is converted to JSON from a string value. 
![varSteps Variable](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/s6bv2mspejta1l7nxvyl.png)

## Condition
We will start the actions with a Condition action. The condition will check whether variable('Flowchart') is equal to Null. If it is  Null, then we'll create on from scratch. If it's not, then we can append to it with further Steps.

![Condition - 1st Time Around](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/wlqxk6qjnc7upqvo1aqy.png)

## Creating a new FlowChart
I will first go through the steps that are required in the Yes or True side. In here we are just creating a brand new Flowchart that is created in the format ready for Mermaid JS. Set the variable **FlowChart** and in the value box we will build our markdown so that it can be read inside the Mermaid JS. We will reference the Object properties from the **varSteps** to build that.

 - Define the type using "flowchart TD"
 - Starting with **“A”** we will enter **variables('varSteps')?['Trigger']** .
 - Then for **“B”** we will add the **variables('varSteps')?['Condition']** 
 - Then **”B-->”** for variables('varSteps')?['Outcome'] 
 - Lastly we will insert the **“C”** **variables('varSteps')?['Action']**.

That should give us all we need to create a new Flowchart.
![Set Variable - FlowChart](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/7zvp9rlxjr433gxf6o1y.png)

## Appending to an Existing Flowchart
On the No / False side of the Condition Action we will be appending to an existing Flowchart. This is useful if there are multiple child flows that make up part of the full process that you are trying to build into a Flowchart. In my Conversational Approval process, there may only be one run of the Approver's Adaptive card, or there may be a need to the Requestor to respond to an Adaptive Card also. Having the Append option allows us to keep building on top of the initial FlowChart that gets created.

## Compose - Last Step
We will start by extracting the alphabetical character for the last step that exists in the Flowchart. For example; if the existing Flowchart is:
```
flowchart TD
A[RM Request] --> B{Matthew Collinge - receives Approval Card}
B -->|Pending| C[Send back to Matthew Collinge]
Then we want the letter **“C”**
```

Using a Compose action we can use. 
```substring(variables('flowchart'), sub(lastIndexOf(variables('flowchart'), '['), 1), 1)```

![Compose - Last Step](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/2mzzl9brk8ec2n40v698.png)

We will need to use this value to increment to the next letter in the alphabet. 

## Compose Letter No
We now get the next letter's number by using the next compose action. Referencing the alphabet variable we get the next number (D would be 4). 
```indexOf(variables('Alphabets'), outputs('Compose_-_Last_Step'),1)```
![Compose - Letter No](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/2gxjgs4hmfgu4kn5ebwj.png)


## Compose Approval
The next compose step is actually composing the approval Markdown text, starting with the original Flowchart and then appending the next steps. It will start with the starting letter that we have derived from the previous few actions. 
```
@{variables('FlowChart')}
@{outputs('Compose_-_Last_Step')} --> @{substring(variables('Alphabets'), add(outputs('Compose_-_Letter_No'),2),1)
}@{variables('varSteps')?['Condition']}
@{substring(variables('Alphabets'), add(outputs('Compose_-_Letter_No'),2),1)
} -->@{variables('varSteps')?['Outcome']} @{substring(variables('Alphabets'), add(outputs('Compose_-_Letter_No'),3),1)
}@{variables('varSteps')?['Action']}
```

![Compose Approval](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/wehwgmjg8qtgvljzzth3.png)


The last step on this append side is setting the Flowchart variable with the output from the previous compose action, so that we have a variable with the whole Flowchart ready to convert to Mermaid JS.
![Set variable - FlowChart Appended](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/hzpyam2i1ty7o4c5vv7c.png)

## Putting it all together

### Compose - URL
After the Condition Action we have a single compose action. 
This will concatenate a string starting with **'https://mermaid.ink/img/'**, and here is where we convert the Flowchart variable to base 64 giving us the correct encoding to create a URL.
```
concat('https://mermaid.ink/img/',base64(variables('FlowChart')))
```
![Compose - URL](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/i5q0heechxjc4wznos7p.png)

### Respond to App or Flow
All we need to do now, is respond to the App or Flow that triggered this Flow. We will use Text input of Flowchart using the Flowchart variable and a text input of Mermaid URL which includes the URL we have just generated.

![Respond to App or Flow](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/1fgvyisoo7coouw643w4.png)

## Inserting this Child Flow into another Flow to capture the steps
Using the **"[child] - Approver Card"** as an example from my previous posts. In our Parent Flow we can construct a JSON Object inside of a Compose action.

### Compose - Outcome
Capture the outcome of the Adaptive Card
![Compose - Outcome](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/p64pumgbabhndg836dee.png)
```
outputs('Post_adaptive_card_and_wait_for_a_response')?['body/submitActionId']
```

### Compose - Action
Convert this outcome using "If(equals" to what the follow on Action will be:

```
if(equals(outputs('Post_adaptive_card_and_wait_for_a_response')?['body/submitActionId'], 'approve'),'Complete Approval',
if(equals(outputs('Post_adaptive_card_and_wait_for_a_response')?['body/submitActionId'], 'respond'), 'Send back to Requestor', 
if(equals(outputs('Post_adaptive_card_and_wait_for_a_response')?['body/submitActionId'], 'reject'),'Inform Requestor',
if(equals(outputs('Post_adaptive_card_and_wait_for_a_response')?['body/submitActionId'], 'acAssignCard'), 'Assign to other person'))))
```
![Compose - Action](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/z8z61g6wg49d5pa07m51.png)

## Compose - varSteps
The JSON Object will be written in a format that could capture various outcomes and statuses that happen within the flow in . For Example:

```
{
  "Trigger": "[@{variables('varObject')?['Request_Type']} Request]",
  "Condition": "{@{variables('varObject')?['Approver_Name']} - receives Approval Card}",
  "Outcome": "|@{outputs('Compose_-_Status')}|",
  "Action": "[@{outputs('Compose_-_Outcome')}]"
}
```
![Compose - varSteps](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/h1wrtozxww9asu3c27ub.png)

Then we can trigger the Child Flow using 'Compose - varSteps' as a String.
```
string(outputs('Compose_-_varSteps'))
```
and then FlowChart. If we're carrying over a previous one held inside our varObject or Null if we're creating a new one.
```
if(empty(variables('varObject')['FlowChart']), 'null', variables('varObject')['FlowChart'])

```
![Run a Child Flow - Generate Mermaid Flowchart](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/yqy2upa1p8vqkiveh9r4.png)

### Capture the Response
To then capture from our child flow and add it to our varObject.
![Update Property](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/bye58sdydt138krtdxm8.png)

![Set FlowChart](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/c9z09ol5tmvjrtbhabvb.png)

## Conclusion
Thank you for reading this post. Please leave feedback in the Comments if you found this useful, or if there are any improvements you could recommend. Please experiment with it too, I'd love to hear some of the outcomes.

For such a simple Flow, I found it quite difficult to write and explain, so I hope it all makes sense!
