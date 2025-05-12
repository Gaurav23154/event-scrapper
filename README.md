# 🗓️ Event Scraper API

A Node.js-powered backend that scrapes event data from **TimeOut Sydney** and **Eventbrite**, stores it in a **SQLite** database, and exposes it through a simple **REST API**. It also supports basic email subscriptions.

## 🚀 Features

- Scrapes real-time events using **Puppeteer**
- Extracts event name, date, location, and link
- Stores data in **SQLite** for fast, local querying
- REST API to fetch events and manage subscriptions
- Scheduled scraping with **node-cron**
- Sends confirmation emails using **Nodemailer**

---

## 📦 Tech Stack

- **Backend**: Node.js, Express.js
- **Scraping**: Puppeteer
- **Database**: SQLite
- **Email**: Nodemailer
- **Scheduler**: node-cron

---


---

## ⚙️ Setup Instructions

1. **Clone the Repository**

```bash
[https://github.com/Gaurav23154/event-scrapper.git]
cd event-scraper-api

Install Dependencies
npm install

Set Up Environment Variables
Create a .env file:
PORT=5000
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password_or_app_password

Run the Server
node server.js


