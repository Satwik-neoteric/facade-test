@echo off
echo Creating working directory if it doesn't exist...
if not exist .\working mkdir .\working

echo Moving candidate files and folders to .\working directory...

echo Moving individual files...
if exist .\Azure-Resources.txt move .\Azure-Resources.txt .\working\
if exist .\build-test.bat move .\build-test.bat .\working\
if exist .\static\css_test.html move .\static\css_test.html .\working\
if exist .\static\direct_test.html move .\static\direct_test.html .\working\
if exist .\templates\css_test.html move .\templates\css_test.html .\working\
if exist .\templates\original_index.html move .\templates\original_index.html .\working\
if exist .\templates\original_label.html move .\templates\original_label.html .\working\

echo Moving directories...
if exist .\clean_project (
    echo Moving .\clean_project to .\working\
    move .\clean_project .\working\
)
if exist .\docker-build (
    echo Moving .\docker-build to .\working\
    move .\docker-build .\working\
)
if exist .\-p (
    echo Moving .\-p to .\working\
    move .\-p .\working\
)

echo.
echo Files and folders moved to .\working directory.
echo Please review them in the .\working directory.
echo You can delete them from there if they are no longer needed,
echo or move them back if you wish to keep them in the project.
pause
