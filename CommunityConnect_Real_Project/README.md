# CommunityConnect — Real Full-Stack Project

This is a real local full-stack application using:

- Node.js
- Express
- SQLite
- better-sqlite3
- bcrypt password hashing
- HTTP-only session cookie authentication
- Admin role access control
- Real database persistence
- Real problem reporting
- Real resource sharing
- Login activity tracking
- Admin problem status management

## 1. Install Node.js

Install the current LTS version of Node.js from the official Node.js website.

Then restart VS Code.

## 2. Open this folder in VS Code

Open the folder:

CommunityConnect_Real_Project

The important files are:

server.js
package.json
public/index.html
public/style.css
public/app.js

## 3. Open the VS Code terminal

Use:

Terminal > New Terminal

Then run:

npm install

Wait until installation finishes.

## 4. Start the project

Run:

npm start

You should see:

CommunityConnect running at http://localhost:3000

Open:

http://localhost:3000

Do NOT open public/index.html directly. The website must run through the Node.js server.

## 5. Administrator account

Email:
admin@communityconnect.local

Password:
Admin@123

After login, the administrator can see:

- Registered users
- Last login time
- Login activity
- Problems submitted by users
- Reporter information
- Problem status
- Delete problem
- Platform statistics

## 6. Test the real user flow

1. Open http://localhost:3000
2. Click Sign In
3. Create a normal account.
4. Report a problem.
5. Share a resource.
6. Log out.
7. Log in again.
8. Open the admin account in another browser/incognito window.
9. Open Admin Dashboard.
10. You will see the user and login activity.

## Database

The SQLite database is automatically created at:

database/community.db

It stores:

- users
- sessions
- login_logs
- problems
- resources

You do not need to manually create the database.

## Important security note

This is a proper local full-stack project for learning and college/project demonstration. Before public production deployment, add HTTPS, secure production secrets, stronger validation/rate limiting, email verification/password reset, database backups, and a production session strategy.

The demo admin credentials should also be changed before deployment.
