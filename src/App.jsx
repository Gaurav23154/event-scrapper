import { useEffect, useState } from 'react';
import axios from 'axios';
import { Toaster, toast } from 'react-hot-toast';
import EventCard from './components/EventCard';
import './App.css';

function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        console.log('Fetching events...');
        const response = await axios.get('http://localhost:5000/api/events', {
          withCredentials: true,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        console.log('Raw response:', response);
        const { data } = response;
        console.log('Response data:', data);
        console.log('Data type:', typeof data);
        console.log('Is array?', Array.isArray(data));
        
        if (Array.isArray(data)) {
          setEvents(data);
          console.log('Events set successfully:', data.length, 'events');
          if (data.length === 0) {
            toast.error('No events found. Try scraping again.');
          }
        } else {
          console.error('Unexpected data format:', data);
          toast.error('Unexpected response format');
          setEvents([]);
        }
      } catch (err) {
        console.error('Error fetching events:', err);
        const errorMessage = err.response?.data?.error || err.message || 'Failed to load events';
        console.error('Error details:', err.response?.data);
        toast.error(errorMessage);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const handleGetTickets = async (eventId) => {
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    try {
      const { data } = await axios.post('/api/subscribe', { email, eventId });
      if (data.redirectUrl) {
        window.open(data.redirectUrl, '_blank');
        toast.success('Redirecting to ticket site...');
      } else {
        toast.error('Failed to get tickets');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to process request');
    }
  };

  const handleManualScrape = async () => {
    try {
      setLoading(true);
      await axios.post('http://localhost:5000/api/scrape');
      toast.success('Scraping completed. Refreshing events...');
      // Refresh events after scraping
      const response = await axios.get('http://localhost:5000/api/events');
      setEvents(response.data);
    } catch (err) {
      toast.error('Failed to scrape events');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-spinner">Loading events...</div>;

  return (
    <div className="app">
      <Toaster position="top-right" />
      <header className="header">
        <h1>Upcoming Events in Sydney</h1>
        <p>Discover the best events happening in Sydney this week</p>
        <button onClick={handleManualScrape} className="scrape-button">
          Refresh Events
        </button>
      </header>

      <div className="email-input">
        <input
          type="email"
          placeholder="Your email for ticket notifications"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="events-grid">
        {Array.isArray(events) && events.length > 0 ? (
          events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onGetTickets={() => handleGetTickets(event.id)}
            />
          ))
        ) : (
          <p>No events found.</p>
        )}
      </div>

      <footer className="footer">
        <p>Events are automatically updated every 6 hours</p>
      </footer>
    </div>
  );
}

export default App;
