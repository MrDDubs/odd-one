---
name: deploy-update
description: >-
  Use this skill when the user asks to deploy, update, push, or sync code changes to the live Oracle Cloud server.
---

# Deploy Stream Hub Update

This skill automates the deployment of the Ally Stream Hub to the Oracle Cloud server.

## Prerequisites
Before running this for the first time, you must ensure you have the server's IP address and the path to the SSH private key. If you don't know them, ask the user. 
Store them safely (e.g., in a `.env.deploy` file or just ask the user once and use it).

## Steps

### 1. Push Local Changes to GitHub
First, ensure all local changes are committed and pushed.
Run the following in the user's terminal:
`git status`
If there are uncommitted changes, ask the user for a commit message or generate one, then:
`git add .`
`git commit -m "<message>"`
`git push origin master` (or main)

### 2. SSH and Update Server
Once the code is on GitHub, SSH into the Oracle Cloud server and run the update commands. 
Execute this command in PowerShell:
`ssh -i "<path_to_private_key>" ubuntu@<server_ip> "cd ~/stream-hub && git pull origin master && pm2 restart stream-hub"`

### 3. Verify
Inform the user that the deployment was successful and the live server has been restarted with the new code!
