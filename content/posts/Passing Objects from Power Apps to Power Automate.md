+++
title = "Passing Objects from Power Apps to Power Automate"
date = 2024-01-10
draft = true
tags = ["Power Apps", "Power Automate", "JSON", "Data Transfer", "Development", "Performance"]
+++

### Introduction
This is the first part, in what I hope will be a series of posts describing how to trigger an advanced approval process. Starting with Power Apps capturing data in a Form and then passing that as a JSON Object or "Record". 

We are passing a JavaScript object as a JSON string from Power Automate to Power Automate. Power Automate has many actions and expressions available to allow us to reference and manipulate the Object once it has been received. More on that later.

I have chosen to implement a JSON Object as it is a common method to store and exchange data. The benefits are that:

- Power Apps code is simpler with all the fields being referenced the once when creating the Object.
- Power Automate is kept more efficient than initiating a Variable for each field value passed

## The Power App

Firstly we need a Power App where we will capture the values in a Form filled in by a user. The Form I have created is just a bunch of Text Input controls. We are going to capture these as a Record into an Object Variable using the Button Control OnSelect property.

![Power Apps - Form](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/0hwq7jrwecinx0f96epb.jpg)

To begin this Function we need to start with this in in the Button's OnSelect Property:
```
Set(
    varObject,
    {
```

Then we can start building the object inside the record (curly brackets). each Field needs a unique name with no spaces. Make sure to make sure to reference the '.Text' Property of the Text Input control, it is quite strict on that.
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
        Rating: rtg_Rating.Value
    }
);
```

## Power Automate
We can now create a Flow ready to receive this Object. We can do this from inside Power Apps or Externally, just make sure that they are both inside the same Solution.

We'll call this **[proxy] - Object Flow** and add a Text Input to the Trigger. As there's no JSON Input option available, we will have to convert the record variable into a JSON text string inside the Power App to allow us to capture it here.

![Power Automate - Create Flow with Trigger](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/7xeth9hnfq5400znvxqp.jpg)

The only action we need so far is **Initialize variable** this is where varObject can be converted back into a JSON Object like this by placing it inside 'json()'.
```
json(triggerBody()?['text'])
```

![Power Automate - Initialize Object Variable](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/va85k2lfr2pxol1niyzj.jpg)

## Power App

Ok, so back to the Power App. To make sure to Refresh the Flow from the Power Automate section of Power Apps, this will just ensure that the Flow is up to date and ready to receive the Text Input.

![Power Apps - Refresh Flow](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/zdv40zgno4ivpu2pmn0p.jpg)

Back in the Button's OnSelect Property and underneath where we set the Variable varObject, we can now send it to the Flow, but inside a 'JSON()'.
```
'[proxy]-ObjectFlow'.Run(
    JSON(
        varObject
    )
)
```

![Power Apps - Button OnSelect](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/a9hjt07vlu3mv0j60xpt.jpg)

## Testing
Now enter some test values in the Form and click on the Button, which should now trigger the Flow and pass the Object over from the App for us.

Now we have an Object ready inside our Flow that we can use to extract data from. 

![Power Automate - Object Received](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/z89kpyini064n98f4n71.jpg)

Each time we need a value we can reference it by using ```
variables('varObject')?['____']
```
The ? operator is only needed for handling null values.

For example:
```
variables('varObject')?['Name']
```

![Power Automate - Name Property](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/dgplwz8ylh9vye0zggux.jpg)

## Summary
Now we have a way to pass a record between Power Apps and Power Automate there are a few useful tricks that I will add soon. We will cover how we can bring over the alternative values for next....
