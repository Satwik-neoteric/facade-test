# Navigate to your project directory (if not already there)
cd c:\projects\facade-studio-asp

# Find the commit reference for "Routes 7-13"
git log --grep="Routes 7-13" --oneline

# Once you have the commit hash, perform the hard reset
# Replace COMMIT_HASH with the actual hash from the previous command
git reset --hard COMMIT_HASH

# If "Routes 7-13" is a tag or branch name, you can directly use:
git reset --hard "Routes 7-13"

# Force push to update the remote repository (if needed)
# WARNING: This will overwrite the remote history, use with caution
# git push --force origin your-branch-name
