import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

const app = express();

// MongoDB connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Scraper function
async function scrapeEvents() {
  console.log('Starting event scraping...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });
  const events = [];

  // Scrape TimeOut Sydney
  try {
    console.log('Scraping TimeOut Sydney...');
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    
    await page.goto('https://www.timeout.com/sydney/things-to-do/best-sydney-events', {
      timeout: 60000,
      waitUntil: 'networkidle0'
    });

    await page.waitForSelector('.card__content, .article-card', { timeout: 10000 });

    const timeoutEvents = await page.evaluate(() => {
      const cards = document.querySelectorAll('.card__content, .article-card');
      console.log(`Found ${cards.length} TimeOut events`);
      return Array.from(cards).map(el => {
        const titleEl = el.querySelector('.card__title, .article-card__title');
        const dateEl = el.querySelector('.card__date, .article-card__date');
        const descEl = el.querySelector('.card__desc, .article-card__desc');
        const linkEl = el.querySelector('a');

        if (!titleEl?.textContent) return null;

        return {
          title: titleEl.textContent.trim(),
          description: descEl?.textContent?.trim() || '',
          date: dateEl?.textContent?.trim() || 'Check website',
          location: 'Sydney',
          source_url: linkEl?.href || '',
        };
      }).filter(Boolean);
    });

    console.log(`Scraped ${timeoutEvents.length} events from TimeOut`);
    events.push(...timeoutEvents);
  } catch (err) {
    console.error('Error scraping TimeOut:', err);
  }

  // Scrape Eventbrite Sydney
  try {
    console.log('Scraping Eventbrite...');
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    
    await page.goto('https://www.eventbrite.com.au/d/australia--sydney/all-events/', {
      timeout: 60000,
      waitUntil: 'networkidle0'
    });

    await page.waitForSelector('[data-testid="event-card"], .eds-event-card, .eds-media-card-content', { timeout: 10000 });

    const eventbriteEvents = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-testid="event-card"], .eds-event-card, .eds-media-card-content');
      console.log(`Found ${cards.length} Eventbrite events`);
      return Array.from(cards).map(el => {
        const titleEl = el.querySelector('h2, .eds-event-card__formatted-name');
        const dateEl = el.querySelector('time, .eds-event-card__formatted-date');
        const descEl = el.querySelector('p, .eds-event-card__description');
        const locationEl = el.querySelector('[data-testid="venue-name"], .eds-event-card__formatted-address');
        const priceEl = el.querySelector('[data-testid="price-range"], .eds-event-card__formatted-price');
        const imgEl = el.querySelector('img');
        const linkEl = el.querySelector('a');

        if (!titleEl?.textContent) return null;

        return {
          title: titleEl.textContent.trim(),
          description: descEl?.textContent?.trim() || '',
          date: dateEl?.textContent?.trim() || 'Check website',
          location: locationEl?.textContent?.trim() || 'Sydney',
          price: priceEl?.textContent?.trim() || 'Price varies',
          image_url: imgEl?.src || '',
          source_url: linkEl?.href || '',
        };
      }).filter(Boolean);
    });

    console.log(`Scraped ${eventbriteEvents.length} events from Eventbrite`);
    events.push(...eventbriteEvents);
  } catch (err) {
    console.error('Error scraping Eventbrite:', err);
  }

  await browser.close();
  console.log(`Total events scraped: ${events.length}`);

  // Save to MongoDB
  if (events.length > 0) {
    try {
      await client.connect();
      const db = client.db('events');
      const eventsCollection = db.collection('events');
      const subscribersCollection = db.collection('subscribers');

      // Create indexes
      await eventsCollection.createIndex({ title: 1 });
      await subscribersCollection.createIndex({ email: 1, event_id: 1 }, { unique: true });

      // Insert events
      for (const event of events) {
        const formattedDate = dayjs(event.date).format('YYYY-MM-DD');
        await eventsCollection.updateOne(
          { title: event.title },
          {
            $set: {
              id: uuidv4(),
              title: event.title,
              description: event.description,
              date: formattedDate,
              time: event.time || 'Check website',
              location: event.location,
              price: event.price,
              image_url: event.image_url,
              source_url: event.source_url,
              last_updated: new Date()
            }
          },
          { upsert: true }
        );
      }
      console.log('Events saved to MongoDB');
    } catch (err) {
      console.error('Error saving to MongoDB:', err);
    } finally {
      await client.close();
    }
  }
}

// API endpoints
app.get('/api/events', async (req, res) => {
  try {
    await client.connect();
    const db = client.db('events');
    const events = await db.collection('events').find().sort({ date: 1 }).toArray();
    res.json(events);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    await client.close();
  }
});

app.post('/api/subscribe', async (req, res) => {
  const { email, eventId } = req.body;
  if (!email || !eventId) return res.status(400).json({ error: 'Missing data' });

  try {
    await client.connect();
    const db = client.db('events');
    
    // Check if already subscribed
    const existing = await db.collection('subscribers').findOne({ email, event_id: eventId });
    if (existing) return res.status(400).json({ error: 'Already subscribed' });

    // Get event details
    const event = await db.collection('events').findOne({ id: eventId });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Add subscription
    await db.collection('subscribers').insertOne({
      id: uuidv4(),
      email,
      event_id: eventId,
      created_at: new Date()
    });

    res.json({ redirectUrl: event.source_url });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    await client.close();
  }
});

// Add a test endpoint to manually trigger scraping
app.post('/api/scrape', async (req, res) => {
  try {
    console.log('Manual scrape triggered');
    await scrapeEvents();
    res.json({ message: 'Scraping completed' });
  } catch (err) {
    console.error('Error during manual scrape:', err);
    res.status(500).json({ error: 'Scraping failed' });
  }
});

// For Vercel serverless functions
export default app;
