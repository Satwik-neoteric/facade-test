Rules

This project should implementthe requirements Upgrade.md

There is a series of Tickets we will implement in order. The Full set of Tickets wll be in tickets.md
No Tickets have been sucessfully passed yet.
The next Ticket will be ticket 1:

Please check existing project code as some of the features will already be implemented

when run locally use HTTP, when used on cloud use HTTPs

The project implements a ASP .Net 8 version of an original example
The original python/flask files canbe found original/facade-studio-asp/
 - Check 
 docs/*
 static/*
 template/app.py

 In order to not break the existing code, my preference would be to keep 

Some additions :
- Configurations should come from environment variabkes, or read from .env in root directory

Cosmosdb:
Database: InputImages
Tables/containers :batches 
- example batches record
{
    "info": {
        "description": "Facade Studio Annotations",
        "date_created": "2025-04-04T16:42:14.694Z"
    },
    "images": [
        {
            "id": "cam1_1742899173",
            "file_name": "B1/cam/cam1_1742899173.jpg",
            "width": 3840,
            "height": 2160
        }
    ],
    "annotations": [
        {
            "id": 1,
            "image_id": "cam1_1742899173",
            "category_id": 1,
            "segmentation": [
                [
                    308.3211678832117,
                    163.5401281649179,
                    714.7445255474453,
                    738.1386683109033,
                    1131.6788321167883,
                    934.3430478729472
                ]
            ],
            "area": 634646.491555224,
            "bbox": [
                308.3211678832117,
                163.5401281649179,
                823.3576642335765,
                770.8029197080293
            ],
            "iscrowd": 0,
            "objectId": "1743615224358"
        },
        {
            "id": 2,
            "image_id": "cam1_1742899173",
            "category_id": 1,
            "segmentation": [
                [
                    991.5328467153286,
                    391.2773544422902,
                    777.8102189781023,
                    738.1386683109033,
                    1271.8248175182482,
                    682.0802741503194
                ]
            ],
            "area": 171354.55271991048,
            "bbox": [
                777.8102189781023,
                391.2773544422902,
                494.0145985401459,
                346.86131386861314
            ],
            "iscrowd": 0,
            "objectId": "1743703909948"
        },
        {
            "id": 3,
            "image_id": "cam1_1742899173",
            "category_id": 2,
            "segmentation": [
                [
                    2140.7299270072995,
                    489.37954422331205,
                    3254.890510948905,
                    647.0437777999545,
                    3244.379562043796,
                    941.3503471430201,
                    2140.7299270072995,
                    1582.518230354699
                ]
            ],
            "area": 1217932.0368693057,
            "bbox": [
                2140.7299270072995,
                489.37954422331205,
                1114.1605839416056,
                1093.138686131387
            ],
            "iscrowd": 0,
            "objectId": "1743708267359"
        },
        {
            "id": 4,
            "image_id": "cam1_1742899173",
            "category_id": 2,
            "segmentation": [
                [
                    974.014598540146,
                    1757.7007121065237,
                    732.2627737226278,
                    1291.7153106466699,
                    1117.6642335766423,
                    1172.5912230554288
                ]
            ],
            "area": 225502.05125472852,
            "bbox": [
                732.2627737226278,
                1172.5912230554288,
                385.40145985401455,
                585.1094890510949
            ],
            "iscrowd": 0,
            "objectId": "1743711878238"
        }
    ],
    "categories": [
        {
            "id": 1,
            "name": "Short-Gasket",
            "supercategory": "Facade"
        },
        {
            "id": 2,
            "name": "Stonework-Fracture",
            "supercategory": "Facade"
        }
    ],
    "BatchID": "B1",
    "ImageID": "cam1_1742899173",
    "id": "cam1_1742899173",
    "Status": "Labelled",
    "_rid": "g6oQAL5mNKoKAAAAAAAAAA==",
    "_self": "dbs/g6oQAA==/colls/g6oQAL5mNKo=/docs/g6oQAL5mNKoKAAAAAAAAAA==/",
    "_etag": "\"0701d084-0000-1100-0000-67f00be50000\"",
    "_attachments": "attachments/",
    "_ts": 1743784933
}
