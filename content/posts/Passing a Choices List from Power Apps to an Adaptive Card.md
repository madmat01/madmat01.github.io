+++
title = "Passing a Choices List from Power Apps to an Adaptive Card"
date = 2024-01-13
draft = true
tags = ["Power Apps", "Adaptive Cards", "Power Automate", "JSON", "UI Design", "Low Code"]
+++

## Introduction 

In a follow-on from my previous post [Passing Objects from Power Apps to Power Automate](https://dev.to/mcombp/passing-objects-from-power-apps-to-power-automate-31ji) I am now going to cover a method I have found to 'render' our JSON Object in an Adaptive Card that is part of an Approval Process.

## Recap

After we have got our Object into Power Automate I mentioned that we can then reference a property by first referencing the name of the Object (varObject) and then the property name `variables('varObject')?['____']`. These can be used inside of an Adaptive Card to show single text values, but what if we want to have a dynamically generated dropdown (choice) list inside of the Adaptive Card?

##  ChoiceSet
![Adaptive Card - ChoiceSet](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/c3hq5qpbzttizr2325md.png) [Adaptive Card - ChoiceSet](https://adaptivecards.io/explorer/Input.ChoiceSet.html)
The Adaptive Card Input.ChoiceSet needs a **Title** and a **Value** for each choice. **Title** is the user friendly name and **Value** is the value passed to your app our service.
```
{
            "type": "Input.ChoiceSet",
            "choices": [
                {
                    "title": "Choice 1",
                    "value": "Choice 1"
                },
                {
                    "title": "Choice 2",
                    "value": "Choice 2"
                }
            ],
            "placeholder": "Placeholder text"
        }
```
So, we need to prepare our data in that format.

##  Choice Collection
The method I have been using to do this is done back in Power Apps...
This is where I am already using a Collection inside my OnVisible property of the Form Screen.

![Power Apps - colCountry Collection](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/o6il1irs1uyw24eoucxz.png)

This is a very basic collection, but in practice your use case may involve generating this from a Datasource Such as Dataverse or SharePoint [Create A Collection (from a datasource) - Matthew Devaney](https://www.matthewdevaney.com/powerapps-collections-cookbook/create-a-collection-from-datasource/).

```
Collect(
    colCountry,
    "England",
    "Northern Ireland",
    "Scotland",
    "Wales"
)
```

This Collection works well for the Country Combobox in our Form.

![Power Apps - colCountry Combobox](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/p3qszploqjct21gztex9.jpg)

But, this Collection isn't quite right for a ChoiceSet yet as it only has a "Value" column. So, to sort this out I have written this, which can run before we create the varObject.
```
ClearCollect(
    colCurrentCountries,//Array of Current countries for passing to Adaptive Card
    ForAll(
        ShowColumns(
            SortByColumns(//Sort Alphabetically
                colCountry,
                "Value",
                SortOrder.Ascending
            ),
            "Value"//We only want this column
        ),
        {
            value: Value,
            title: Value
        }
    )
)
```
I will break down what is happening here:
 - First we create a collection called "colCurrentCountries" `ClearCollect(colCurrentCountries,`

 - Then we're going to loop through each country in the existing "colCountry" Collection using ForAll() to do the looping. But, we only need the "Value" column (this isn't strictly necessary in my example). Neither is 'SortByColumns()', but it keeps things tidy 🙂.
```
ForAll(
       ShowColumns(
           SortByColumns(//Sort Alphabetically
               colCountry,
               "Value",
               SortOrder.Ascending
           ),
           "Value"//We only want this column
       ),`
```
- The last part to construct is the schema of each record inside this Collection. To do this I'm just repeating the "Value" column for both the Title and Value as I've no need to for these to be different in the Adaptive Card.
```
        {
            value: Value,
            title: Value
        }
```

## Adding the Collection to the Object
To add the Collection or Array to the Object we just need to add the line 'Countries: colCurrentCountries' like so:
```
Set(
    varObject,
    {
        Name: txt_Name.Text,
        Address_1: txt_Address_1.Text,
        Address_2: txt_Address_2.Text,
        City: txt_City.Text,
        Country: cbx_Country.Selected.Value,
        Mortgaged: tgl_Mortgaged.Value,
        Rating: rtg_Rating.Value,
        **Countries: colCurrentCountries**
    }
```
So now with everything put together in Power Apps we have this in the OnSelect Property that runs the Flow:
```
ClearCollect(
    colCurrentCountries,//Array of Current countries for passing to Adaptive Card
    ForAll(
        ShowColumns(
            SortByColumns(//Sort Alphabetically
                colCountry,
                "Value",
                SortOrder.Ascending
            ),
            "Value"//We only want this column
        ),
        {
            value: Value,
            title: Value
        }
    )
);
Set(
    varObject,
    {
        Name: txt_Name.Text,
        Address_1: txt_Address_1.Text,
        Address_2: txt_Address_2.Text,
        City: txt_City.Text,
        Country: cbx_Country.Selected.Value,
        Mortgaged: tgl_Mortgaged.Value,
        Rating: rtg_Rating.Value,
        Countries: colCurrentCountries
    }
);
'[proxy]-ObjectFlow'.Run(
    JSON(
        varObject
    )
)
```
## Power Automate
To see this in an Adaptive Card in Power Automate for now we need to add an Action: "Post card in a chat or channel" Posting As: **Flow Bot** and Post In: **Chat with Flow Bot**. For testing add your email address for our "Approver" and then we can construct the Message.
![Power Automate - Adaptive Card Message](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/ownwyd8ofxksxgbph7wd.png) _Yes, this screenshot is from the V2 designer_ 😫

## Adaptive Card
I would recommend you build your full Adaptive Card by previewing it with the Help of (https://adaptivecards.io/designer/)[The Adaptive Card Designer] or the (https://marketplace.visualstudio.com/items?itemName=TeamsDevApp.vscode-adaptive-cards#:~:text=The%20Microsoft%20Adaptive%20Card%20Previewer,%2C%20and%20high%2Dcontrast%20themes.)[VSCode Microsoft Adaptive Card Previewer]

To help us out a little, here is a basic Adaptive Card with a Single ChoiceSet Input, with it waiting for you to type in some choices:
```
{
    "type": "AdaptiveCard",
    "body": [
        {
            "type": "Input.ChoiceSet",
            "choices": [
                {
                    "title": "Choice 1",
                    "value": "Choice 1"
                },
                {
                    "title": "Choice 2",
                    "value": "Choice 2"
                }
            ],
            "placeholder": "Placeholder text"
        }
    ],
    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
    "version": "1.5"
}
```
Now to make this work with the Data passed over from our varObject Variable in Power Automate.

 - First Remove the "choices" array - the **[** to the **]** and replace this with a reference to our Countries list in varObject, like this:
```
"choices": @{variables('varObject')?['Countries']},
```
 - Then we can add the Country value that was selected in the Power App Form, by adding this (The ? operator is only needed for handling null values.):
```
"value": "@{variables('varObject')?['Country']}"
```
 - Then  we need to add an ID for the field.
```
"id": "Country",
```
 - And for reasons I don't understand we need to change the version from 1.5 to 1.4 to work with Teams version 1.7?!?`
```
    "version": "1.4"
}
```

## Power Automate
We then have an Adaptive Card that we can paste in to the Message in Power Automate.
```
{
    "type": "AdaptiveCard",
    "body": [
        {
            "type": "Input.ChoiceSet",
            "choices": @{variables('varObject')?['Countries']},
            "placeholder": "Placeholder text",
            "id": "Country",
            "value": "@{variables('varObject')?['Country']}"
        }
    ],
    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
    "version": "1.4"
}
```

Save the Flow and Refresh the Flow in the Power App too. If you get 
"_[proxy]-ObjectFlow.Run failed: { "code":
"InvokerConnectionOverrideFailed", "message": "Failed to parse invoker connections from trigger 'manual' outputs. Exception: Could not find any valid connection for connection reference name
'shared_teams' in APIM header." }_" Just Save and Re-Open the Power App 🙂.

## Teams
Submit the Form in the Power Apps and Teams should now send you a message with the Selected Country and when you select the Choices, give you a selection of other Countries.

![Teams - Selected Country](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/k88ompzkx2pi4qpjp0lv.png)

![Teams - Countries](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/aiyw79dssrxm3tihzt3f.png)

##Conclusion
Hopefully this is a helpful tip and I will elaborate on how we can get more in to Adaptive Cards soon.
Please leave any questions or comments below.