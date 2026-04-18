+++
title = "Conversational Approval process using Adaptive Cards and JSON objects"
date = 2024-01-29
draft = false
image = "/images/posts/adaptive-cards-approval.jpeg"
tags = ["PowerApps", "AdaptiveCards", "Power Automate", "Adaptive Cards", "Microsoft Teams", "Low Code", "JSON", "Power Platform"]
+++

## Introduction

This is Part 3 of a series of posts where I try to explain how to send Form answers from a Power App into Power Automate and then send Adaptive Cards in Microsoft Teams to allow the Requestor and Approver make incremental changes to the Form answers.

[Part 1](https://dev.to/mcombp/passing-objects-from-power-apps-to-power-automate-31ji)

[Part 2](https://dev.to/mcombp/passing-a-choices-list-from-power-apps-to-an-adaptive-card-2nga)

We're going to start Part 3 by building a second Flow. In this Form Approval Process this Flow will actually be the one that sends an Adaptive Card to our Approver.

Here is an overview of what we're going to do here.

![Solution Process Flow](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/gle4iksyoo6f8ar1aazy.png)

## Why don't I use the standard Approvals Actions?

What I'm trying to achieve is a more conversational process for the Approval, where the Requestor and Approver can both edit the data inside Message Cards in Teams until the Approver decides what to do with it.. We'll do this by passing our Object again, plus a few other useful Expressions.

We're going to trigger this from our "[proxy] - Object Flow" we made in an earlier Post: [Passing Objects from Power Apps to Power Automate](https://dev.to/mcombp/passing-objects-from-power-apps-to-power-automate-31ji).

## The Approver's Flow

As this will be a Child Flow. We'll need a Manual trigger and I'll call this Flow **"[child] - Approver Card"**. We just need one text Input. **varObject** as this can contain everything we need.

Then, we'll Initialize a Variable that will convert the Text Input to JSON. 
```
json(triggerBody()['text'])
```

![Power Automate - Manual Trigger](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/c8doqcunjsnxb3vtbhjq.png)

## Adaptive Card
Let's add another action - **Post adaptive card and wait for a response**. We'll need to construct an Adaptive card for this. Again I would recommend you build your full Adaptive Card by previewing it with the Help of [The Adaptive Card Designer](https://adaptivecards.io/designer) or the [VSCode Microsoft Adaptive Card Previewer](https://marketplace.visualstudio.com/items?itemName=TeamsDevApp.vscode-adaptive-cards#:~:text=The%20Microsoft%20Adaptive%20Card%20Previewer,%2C%20and%20high%2Dcontrast%20themes.)

![Power Automate - Post adaptive card and wait for a response](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/nxyss5pinjgy81at54s3.png)


**Text Inputs**
I will start with the Text value we're getting for the "Name" field in the Form.
 - We need a type, this will be **Input.Text**
 - We can specify the Label above the field as "Name"
 - For the Value, we can reference the property inside of **varObject** by inserting "@{variables('varObject')?['Name']}" 
 - Finally, each field in the Adaptive Card needs an id, which we can keep exactly the same as the Object Property name to make it easier to reference in the future.

In my scenario, we already have an input value, so 'Placeholder Text' isn't really needed.

```
    {
      "type": "Input.Text",
      "label": "Name",
      "value": "@{variables('varObject')?['Name']}",
      "id": "Name"
    },
```
You can use the example above to build any other Text Inputs.

**Toggle**
The 'Mortgaged' field is a Boolean field in our Power Apps Form, so we can replicate this with **Input.Toggle**, similar to the Text Input we need to give an **id**, **label** and **value**.

```
    {
      "type": "Input.Toggle",
      "title": "Mortgaged",
      "id": "Mortgaged",
      "label": "Mortgaged",
      "value": "@{variables('varObject')?['Mortgaged']}"
    },
```

**Choices**
I have previously described how we can have a Choices Dropdown in this Blog Post: 
[Passing a Choices List from Power Apps to an Adaptive Card](https://dev.to/mcombp/passing-a-choices-list-from-power-apps-to-an-adaptive-card-2nga) - in this example, we can add a Label: **"Country"**
```
    {
    "type": "Input.ChoiceSet",
    "label": "Country",
    "choices": @{variables('varObject')?['Countries']},
    "id": "Country",
    "value": "@{variables('varObject')?['Country']}"
    }
```
For the **Rating** Field, we know there's only five options, so we might as well enter these manually, giving us this: 

```
{
      "type": "Input.ChoiceSet",
      "choices": [
        {
          "title": "1",
          "value": "1"
        },
        {
          "title": "2",
          "value": "2"
        },
        {
          "title": "3",
          "value": "3"
        },
        {
          "title": "4",
          "value": "4"
        },
                {
          "title": "5",
          "value": "5"
        }
      ],
      "label": "Rating",
      "id": "Rating",
      "value": "@{variables('varObject')?['Rating']}"
    }
```

**Actions**
That's the fields done, now we need some actions to respond with. These can be placed at the foot of the Adaptive Card like this and will be where the Approver makes their decision.

```
  "actions": [
        {
            "type": "Action.Submit",
            "title": "Approve",
            "style": "positive",
            "id": "approve"
        },
        {
            "type": "Action.Submit",
            "title": "Respond",
            "id": "respond"
        },
        {
            "type": "Action.Submit",
            "title": "Reject",
            "style": "destructive",
            "id": "reject"
        },
        {
        "type": "Action.ShowCard",
        "title": "ReAssign",
        "card": {
            "type": "AdaptiveCard",
            "body": [
                {
                "type": "Input.Text",
                "label": "ReAssign to",
                "style": "Email",
                "id": "ReAssign_To",
                "isRequired": true,
                "errorMessage": "Please enter an email address"
                }
            ],
            "actions": [
                {
                "type": "Action.Submit",
                "title": "ReAssign"
                }
            ]
        },
        "id": "acAssignCard"
        }
    ]
```

Feel free to elaborate on the options you provide, such as comments, or even an option to reassign. We'll use these soon in a Switch Action to decide on the next step. IF you want to use this you'll see that there's an expandable section (https://adaptivecards.io/explorer/Action.ShowCard.html)[Action.ShowCard] when **ReAssign** is selected, this is to ensure an email address is entered. 
![Adaptive Card - Approver Actions](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/ih8l00gjkemqfszfmwt8.png)

[The JSON for the Approval Adaptive Card is here.](https://github.com/madmat01/devtoBlog/blob/main/Approver%20Card.json)


## Union
Now we have an Adaptive card that we can send to an Approver and Wait for a response. 

We can now capture any changes that the Approver may have made back into our original **varObject**. 

Start by adding a Compose Action, and in the Compose Action we can enter this Expression

```
union(variables('varObject'),outputs('Post_adaptive_card_and_wait_for_a_response').body.data)
```
![Compose - Union Body Data with varObject](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/gpehha063xcao82dsbfj.png)
What the Union expression does is combine the properties from the varObject with the data obtained from the response of the action **Post_adaptive_card_and_wait_for_a_response**. This is done to update or synchronize the values in the **varObject** with the field values changed in the Adaptive Card.

Then we just need to feed the output of our Compose expression into Set the **varObject**.
![Set variable - varObject](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/46viu3n3x7xrlcijz0q7.png)

## Switch
We'll add a switch Condition to allow us to decide the path of the Flow from this point using some Switch Cases, which match the the ID of our Actions.

```
outputs('Post_adaptive_card_and_wait_for_a_response')?['body/submitActionId']
```
We have the options: **approve**, **respond**, **reject**, **ReAssign_To** and we can decide what we we want to happen with each of these paths. I'll come to **respond** in a moment, but I will first give some examples of how you can use the other Switch Cases.

![Power Automate - Switch](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/rw1sewu61kir7vzwn796.png)

**Approve**
This would be where you would define what you want to happen if the Adaptive Card is approved; Send an Email, update a SharePoint List Item etc...

**Reject**
Here you could send Post a Standard Adaptive card or send an email to the Requestor.

**ReAssign**
A good example for using the **setProperty()** expression would be if you had a defined Approver_Email in your varObject. You could use a Compose Action with:
```
setProperty(variables('varObject'), 'Approver_Email', outputs('Approver_adaptive_card')?['body/data/ReAssign_To'])
```
Then, Set Variable - varObject again with the output of the Compose Action.

![Power Automate - ReAssign](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/4fq2s12iroz5syxmnkmv.png)

**Respond**
So for the Respond Case, we're going to create another Child Flow, it will be a copy of this Flow where the Requestor can make changes to re-submit to the Approver.

### Respond to a PowerApp or flow
To make sure this Child Card let's the Parent Flow it has run, place in a **Respond to a PowerApp or flow** as the last Action.

## [proxy] - Object Flow
Before we move on to the Requestor Card, we need to trigger this Child Flow from the **[proxy] - Object Flow** by making this the 3rd action in the Flow.
![Object Flow - Run a Child Flow - [child] - Approver Card.png](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/c55672arxmxdf2qm64g0.png)

## Requestor Card
Now - back to the **[child] - Approver Card]** Flow, so we can copy it....
![Copy of - [child] - Approver Card](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/exjjtr61ge4day8b0v6u.png)

We'll call this: **[child] - Requestor Card** and add it to the same solution as our App and other Flows.

Let's first make a couple of small adjustments to the **Post adaptive card and wait for a response** Message in this one by changing the first TextBlock with text Property from:
![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/90eynqlss86t35550rb7.png)

To:
```
    {
      "type": "TextBlock",
      "size": "Medium",
      "weight": "Bolder",
      "text": "Requestor Request"
    },
```

Then we just need to swap out the **"actions": []** section at the bottom of the Card. The Requestor won't have the same options as the Approver, so we can swap out the whole section for this:
```
  "actions": [
        {   
        "type": "Action.Submit",
        "title": "Re-Submit 🔁",
        "id": "acSubmit",
        "style": "positive"
      },
      {
        "type": "Action.Submit",
        "title": "Cancel Request ❌",
        "id": "acCancelRequest",
        "style": "destructive"
      }
    ]
```
And of course, change the Receipient, so that the message goes to our Receipient. The Union action is still here to update any changes which then update our varObject.

## Switch 
As we've changed the Actions, we'll now need to change the cases to **"acSubmit"** and **"acCancelRequest"**. 

![Power Automate - Requestor Switch](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/ugdhlkvq4g2c9wv0rkyq.png)

**acCancelRequest**
Again, I'll leave it up to you what to do with this path; you may want to imform the Approver with another standard Adaptive Card message.

**acSubmit**
So here's the key feature that allows us to perform this conversation loop between the Approver and Requestor. - We're now going to re-trigger **[child] - Approver Card** and with that, pass back the varObject as a String again.

Create a **'Run a Child Flow'** action and select our **[child] - Approver Card** Flow we created earlier. For the varObject Text Input enter: **_string(variables('varObject'))_** - this converts the **varObject** into a String again to pass to Approver Flow.

![Child - Approver Card](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/ubt2qdgft8igtp7i0n86.png)

## Respond to a PowerApp or flow
Again, to make sure this Child Card let's the Parent Flow it has run, place in a **Respond to a PowerApp or flow** as the last Action.

[JSON for the Requestor Adaptive Card is here](https://github.com/madmat01/devtoBlog/blob/main/Requestor%20Card.json)

## Back to [child] - Approver Card to finish off
All we need to do now is the mirror opposite of this in the **[child] - Approver Card** Flow. Go back to that flow and underneath the **Case - respond** create a **'Run a Child Flow'** action and select our **[child] - Requestor Card**  

![Run a Child Flow - [child] - Requestor Card](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/7oj1sulh4pdr6khwse4i.png)

## Testing and fine tuning

To prevent any confusing repeat runs of these Flows, I would recommend changing the Retry Policy
on each Run a Child Flow Action to **None** 

![Retry Policy - None](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/aqb4qi9z6w9r9sk4u46f.png)

So, here are some examples that we should see in Microsoft Teams.

### Power App Form
![Power App Form](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/qoh1avf7c2tx9bpq8klx.png)

### Approver's 1st Message 
![Approver's 1st Message ](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/cnqbp9bapdg8e2fibysx.png)

### Requestor's 1st Message 
![Requestor's 1st Message ](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/tyq28vlocm90db1qe112.png)

### Approver's 2nd Message
![Approver's 2nd Message](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/w7zu2rfav31v1f7u0dob.png)

# Conclusion
Hopefully, that was a helpful guide. I have one final Post to add a little bit extra to this type of Approval process. Please leave any questions or comments below.
