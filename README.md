# Presence Checker
Abstract:
RollCall is a frictionless attendance system that requires no user accounts or installs. A teacher creates a session, gets a student join code and a private teacher dashboard link, and optionally defines a roll-number format. Students open the session link, photograph their ID card to auto-read their roll number and name, then take a live selfie. A perceptual hash checks whether the same selfie was submitted under a different roll number, flagging possible duplicates for the teacher. Teachers can also upload a class roster PDF to identify absentees, manually mark missing students as present or resolve flagged records, and export the final present/absent list as a CSV. All database access is gated through server-side functions that verify the join code or teacher code, so no one without a code can access session data.
 

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ecap-attendance.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a8c2d703-bab5-403e-b53f-fc14e0358ff5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
