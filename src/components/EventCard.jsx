export default function EventCard({ event, onGetTickets }) {
    return (
      <div className="event-card">
        {event.image_url && (
          <div className="event-image">
            <img src={event.image_url} alt={event.title} />
          </div>
        )}
        <div className="event-details">
          <h3>{event.title}</h3>
          <p className="event-date">{event.date}</p>
          <p className="event-location">{event.location}</p>
          {event.price && <p className="event-price">{event.price}</p>}
          {event.description && (
            <p className="event-description">
              {event.description.length > 100
                ? `${event.description.substring(0, 100)}...`
                : event.description}
            </p>
          )}
          <button className="ticket-button" onClick={onGetTickets}>
            GET TICKETS
          </button>
        </div>
      </div>
    );
  }
  