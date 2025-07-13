Add batch management section in the admin page of the facade app
The template for it is currently defined under admin.html, we want it to add to it to allow users to run inference on new batches, register a batch, upload images to a batch and download images from a batch.
The backend implementation for all these have defined in a azure function, the code for it has been tested and I have attached a reference function_app.py file for reference call
All inputs to the post call should come from the user - build modal forms for it. Compalsury inputs should be required and the other inputs user should be able to choose if they want to pass in the form or not.
The aim is to not break any existing code and to add batch management functionality to the current code
User should be able to view all the batches have been run 
You can have a look at the label page implementation as it already gets the list of batches
Focus should be on code modularity

In the admin section we should add a table with the title Batch management list details of all the batches
and on the top right corner of the table we should have buttons to upload images to a batch, register a new batch and run inference for a batch. 
The user should be able to expand a batch to list images under it and download the image it likes.

Ensure ui and look and feel is consistent with the rest of the admin page.

Function Urls
blob2cosmos - https://batch.azurewebsites.net/api/blob2cosmos?code=<YOUR_FUNCTION_KEY>
download_images - https://batch.azurewebsites.net/api/download?code=<YOUR_FUNCTION_KEY>
get_status - https://batch.azurewebsites.net/api/status?code=<YOUR_FUNCTION_KEY>
submit_job - https://batch.azurewebsites.net/api/submit?code=<YOUR_FUNCTION_KEY>
upload_images - https://batch.azurewebsites.net/api/upload?code=<YOUR_FUNCTION_KEY>
