+++
title = "Extract table data from Documents using Azure AI Document Intelligence"
date = 2024-10-16
draft = false
image = "/images/posts/document-intelligence.jpeg"
tags = ["Azure AI", "Document Intelligence", "Power Automate", "AI Builder", "OCR", "Table Extraction"]
summary = "How to use the Azure AI Document Intelligence Layout Model REST API with Power Automate to extract text and table data from PDF documents."
+++

##Extract table data from Documents Using Azure AI Document Intelligence Layout Model with Power Automate

![Document Intelligence Studio](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/x6so0e1ifuegxe8n025f.png)
Azure AI Document Intelligence is a cloud-based service that allows you to build intelligent document processing solutions. It uses machine learning to extract text, tables, and key-value pairs from documents, providing structured data for easy use.

In this post, I’m going to go through how to send a PDF document using an Azure AI Document Intelligence REST API request and return the text and table information using the Layout model. I’ll go through some of my processes for transforming the received JSON output into an array that can be used to create rows in a Dataverse table, all within Power Automate.

Power Automate isn’t Power Query, so I will use some techniques to get it to try and replicate some of the filtering, cleansing, and sorting capabilities of Power Query. Some of the filtering can be quite specific to the documents you have, so I will start quite general and then cover some techniques to cleanse the data by type alongside.

#Choosing a Model
* I would highly recommend that you use the [Azure AI Document Intelligence Studio](https://documentintelligence.ai.azure.com/studio) to find the most suitable model for your documents. You can try out models in the studio with your own documents. I did this and was confused about how you can actually use the model. The studio provides code examples, but you are kind of left to it from then on. When I’d found the [REST API Documentation ](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/how-to-guides/use-sdk-rest-api?view=doc-intel-3.1.0&tabs=windows&pivots=programming-language-rest-api)I certainly felt more comfortable, as I can use this with Power Automate!

* Test multiple documents as you may discover inconsistencies in the results. To get around these, you can adjust some of the actions and expressions in your Flow to deal with them.

#My Example
![Example PDF Preview](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/v7a1nnasppsumcncxboc.png)
I have created a simple document that includes one table and I like sausages, but in the real world, I have dealt with documents of all shapes and sizes. For example, where the tables start on a different page (we can append `&pages=` to the URI to extract a specific page 🙂).

#Passing the Document to Azure AI Document Intelligence
I have to start by mentioning that I could not have done this first part without the help of this YouTube video from the excellent [Damien Bird](https://damobird365.com/
) on [Power Automate Invoice Processing Tutorial AI Builder and Azure](https://youtu.be/fLHmEwcg8Jo?si=whD4IAvsr-oojTm5). Here Damien explores the AI Builder option and compares the costs, introduces the Document Intelligence Service on Azure, polling the services, reviewing the Response, and selecting data from the response.

We’re basically going to do the same, but select the **Layout Model API Version 2023-07-31** from Azure AI Document Intelligence.

#Azure Services
Before we start building our Flow, we will need some Azure Services set up:

* Resource Group
* Azure AI Services > Document Intelligence (Select the F0 Pricing tier for up to 500 documents per month for free, much better than AI Builder).
* Azure Key Vault Secret

Make sure to copy the Endpoint, as we will need this in our Flow. To keep things secure keep your key inside Azure Key Vault. I can recommend following this video [Power Automate +Azure Key Vault - get key and secret and pass to Flow](https://www.youtube.com/watch?v=HA1BMJJCDF0) from Sean Astrakhan on how to do this.

#Flow Structure
Ok, let’s get on with the Flow!
![Flow Overview](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/az8jn4un0gb38m0q3wq3.png)

###Manual Trigger
Start with a manual trigger with a File Content Input. This will be used to bring the PDF Document into the Flow.
![Manual Trigger](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/vmkb5imws0u18s39zag9.png)

and then set up some variables....

**Initialize variable – Status** - We will need to use this String Variable to set the outcome of the second HTTP request status.

**Initialize variable – Metadata** - We will use this Object Variable to contextualise and reference the Document that we have extracted from.

**Initialize variable - ParsedCellsArray** - We will use this Array Variable to loop through the table cells.

###Azure Key Vault Get secret
Enter the name of your Azure Key Vault secret to return its value. In settings, enable ‘Secure inputs’ and ‘Secure outputs’ to ensure the secret is hidden.

###HTTP Request
This is where the fun starts. Add an HTTP Action.

**URL**: _{Your Azure AI Service Endpoint}/formrecognizer/documentModels/prebuilt-layout:analyze?api-version=2023-07-31_

There’s some [more information here](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/how-to-guides/use-sdk-rest-api?view=doc-intel-3.1.0&tabs=windows&pivots=programming-language-rest-api) on versions and models. Here I have chosen the Model: **prebuilt-layout** and the api-version of **2023-07-31** – which is GA at the time of writing. It’s worth noting that I struggled to use the newer preview models due to my Azure AI services location being UK South (we have to wait for the new toys!).

*Method*: _POST_
*Headers*: _Ocp-Apim-Subscription-Key: {Azure Key Vault Secret Value}_
**Body**:
`{"base64Source": triggerBody()?['file']?'contentBytes']}`

For the body, we are passing the '‘File content contentBytes’' value from the Manual Trigger. This converts the file into base64 format so that it can be uploaded as part of the request.
![HTTP Request](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/myc252s5cud511kvmmvq.png)
Now we have a way to send the Document, we then need a way to wait until it has been processed.

###Do Until
Create a Do Until polling loop using **Loop Until** so that we can wait for the service to process the document and send back a response.

![Do until](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/j98iyfkbhr0qe1ciz0fd.png)
###Variable Status is equal to “succeeded”, with a Count of 5 to limit the number of retries, with a 1 hour timeout.

Within the Do Until we need:

###Delay: 10 Second Delay
**HTTP_1:** This HTTP action uses the ‘Operation-Location’ Header from the first HTTP action to check if the service has completed.

**URL:** _outputs('HTTP')?['headers/Operation-Location']_
**Method**: _GET_
**Headers**: _Ocp-Apim-Subscription-Key: {Azure Key Vault Secret Value}_
![HTTP_1](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/h6msc60366cne584brks.png)

###Set the Status Variable:
**Value**: _body('HTTP_1')?['status']_

###After the Do Until:

`body('HTTP_1')?['analyzeResult']`
Now we have a response from the Azure AI Document Intelligence Model, we can start to deal with the JSON that we get back. As Damien Bird mentions, it is helpful to visualise this output using [https://codebeautify.org/jsonviewer](https://codebeautify.org/jsonviewer) to give yourself an idea of the output structure and how to reference and extract the data in your Flow.

###Extract the Document Information
I have decided that it is important to extract some of the headers from the document as well as the table data in order to give context to the information.

###Parse JSON – Paragraphs
![Layout Model Paragraphs](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/qaqjstqbld0htmvujkws.png)
As the Layout model gives us the text in the `body('HTTP_1')?['analyzeResult/paragraphs']` we can just select that.

**Content**: _body('HTTP_1')?['analyzeResult/paragraphs']_
**Schema**:
```json
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "content": {
        "type": "string"
      }
    },
    "required": ["content"]
  }
}
```
As we only need the Content properties, I have shortened the Schema so that only the **['content']** is returned in the output.
![Parse JSON - Paragraphs](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/u2f70yc9qbizpbr3aqvw.png)

###Set variable - Metadata Object
**Name**: _Metadata_
**Value**:
```json
{
  "Report_Name": "@{body('Parse_JSON_-_Paragraphs')['content']}",
  "Issue_No": "@{first(split(\r\nbody('Parse_JSON_-_Paragraphs')['content'],'\n'))}",
  "Issue_Date": "@{last(split(\r\nbody('Parse_JSON_-_Paragraphs')['content'],'\n'))}"
}
```
Here we use the index of the **['content']** property to extract the values that we want. This is where it is helpful to preview the output using [https://codebeautify.org/jsonviewer](https://codebeautify.org/jsonviewer) so that you can work out the index beforehand. In my example, the Report Name is the 2nd value **[1]** and then I have used a `Split()` expression on the **"|"** to allow me to capture the `first()` and `last()` values either side of the **“|”** giving us the **Issue_No** and **Issue_Date**.

This is just an example, you will want to adjust the structure of your output to meet your own needs. We have captured this as an object here so that we can then align it alongside the table rows later.

###Extracting the table rows
![Layout Tables](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/6h98l1aharcj2kr8bec3.png)
###Parse JSON
We can now use a Parse JSON to extract all the Table data by selecting the child property `/tables`.

![Parse JSON](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/vrtv3a7thcdsfcxiidph.png)

**Content**: _body('HTTP_1')?['analyzeResult/tables']_
**Schema**:
```json
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "columnCount": {
        "type": "integer"
      },
      "cells": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "rowIndex": {
              "type": "integer"
            },
            "columnIndex": {
              "type": "integer"
            },
            "content": {
              "type": "string"
            }
          },
          "required": ["rowIndex", "columnIndex", "content"]
        }
      }
    },
    "required": ["columnCount", "cells"]
  }
}
```
This is the full schema as we do need a few of the properties.

###For each – Table
**Input**: _body('Parse_JSON')_
If you have multiple tables to go through, this is useful; if not, you can skip this action.
![For each - Table](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/bwxwjjogev1vwbiq2k6p.png)

###Set variable ParsedCellsArray
Set the **ParsedCellsArray** variable with 'cells' - this is the tables cells.
**Name**: _ParsedCellsArray_
**Value**: _items('For_each_-_Table')['cells']_

###Select
So, if we were to just use....
###From: "@variables('ParsedCellsArray')",
###Map:
```json
{
 "content" : @item()?['content'],
 "rowIndex" : @item()?['rowIndex'],
 "columnIndex" : @item()?['columnIndex']
}
```
Then we would get each cell on top of each other in separate objects,
![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/49z5qcip8rrng422884z.png)
which we would have to somehow ZigZag across or remap, as we want every object in our array to contain a Name and a Price. 

![Standard Select Power Query](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/nesj9gledrh6w3gxijmk.png)

To do this we need to integrate a Range into the Select action using: ```range(0, length(variables('ParsedCellsArray')))``` to generate an index to iterate over the array.

####From
In order to get the value of the adjacent column in the Select action, we can use `range(startIndex: integer, count: integer)` and use `length()` to use the length of **ParsedCellsArray**. This allows the Select action to iterate over each element in **ParsedCellsArray **and generate a sequence of numbers.

####Map
This number sequence is then used in the **Map** for the last Property to get the next element “**nextContent**”.

**nextContent**:
```@{if(less(item(), sub(length(variables('ParsedCellsArray')), 1)), variables('ParsedCellsArray')[add(item(), 1)]?['content'], null)}```

This expression uses the `If()` function to check if the current index `item()` is less than the last index of the array `sub(length(variables('ParsedCellsArray')), 1))`. 
* If true, it retrieves the content of the next element `variables('ParsedCellsArray')[add(item(), 1)]?['content'])`.
* If false (i.e., the current element is the last one), it returns null.

So to put this all together we get:

**From**: _range(0, length(variables('ParsedCellsArray')))_
**Map**:
```json
{
  "content": "@{variables('ParsedCellsArray')[item()]?['content']}",
  "rowIndex": "@{variables('ParsedCellsArray')[item()]?['rowIndex']}",
  "columnIndex": "@{variables('ParsedCellsArray')[item()]?['columnIndex']}",
  "isColumnHeader": "@{equals(variables('ParsedCellsArray')[item()]?['kind'], 'columnHeader')}",
  "Index": "@{item()}",
  "nextContent": "@{if(less(item(), sub(length(variables('ParsedCellsArray')), 1)), variables('ParsedCellsArray')[add(item(), 1)]?['content'], null)}"
}
```
![Select](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/b2og84d2lnvd4vviw1qc.png)

The outcome of this starts to line up for us, but still needs Filtering... For example we only need the first Column and we can ignore the column headers.
![WorkingExport - Power Query](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/yhfvpj0dadrr6r9u35zo.png)


###Filter Array
We can use Filter Array to filter the returned data. This is especially useful if the tables contain some data that we don’t want, such as comments or notes. Rather than using a single, **basic filter**, we need to switch to **advanced mode** 🤓 to combine the multiple conditions we want. 
You may want to use other conditions inside the `and()` expression to fine-tune your data.

**From**: _body('Select')_
**Advanced Filter:**
```json
@and(
    equals(item()?['columnIndex'],0), //Only use the first column
    equals(item()?['isColumnHeader'], false), //Ignores the Column Header
    not(equals(item()?['content'], '')), //No Blanks
    not(equals(item()?['nextContent'], '')), //No Blanks
)
```
![Filter Array](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/pvatdbb4qtpe8c4gd0fd.png)

###Select – Filtered Table
We can merge in some of the metadata extracted from the Document, which we can now align in the context of each record in the array. The first three in my example are from the Metadata Object created earlier. You can also use this opportunity to further cleanse the values returned using string expressions if you need.

**From**: _body('Filter_Array')_
**Map**:
```json
{
  "Report_Name": @{variables('Metadata')?['Report_Name']},
  "Issue_No": @{variables('Metadata')?['Issue_No']},
  "Issue_Date": @{variables('Metadata')?['Issue_Date']},
  "Product": item()?['content'],
  "Price": item()?['nextContent']
}
```

![Select - Filtered Table](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/gjcclchanvq4zmu03k6i.png)
##Set variable - Filtered TransformedArray
Value: `body('Select_-_Filtered_Table')`
We will capture the table data into an array so that we can use it elsewhere. Here you can do whatever you want with your array. If you want to use an Add a new row Dataverse action, you can map each array property in the action for example.

###Conclusion
Thank you for reading this post. Hopefully, this is useful to anyone who needs to use this particular Azure AI Document Intelligence Model to process their Documents and place the data into a more organised format.  Please leave feedback in the Comments if you found this useful, or if there are any improvements you could recommend. Please experiment with it too, I'd love to hear some of the outcomes.

