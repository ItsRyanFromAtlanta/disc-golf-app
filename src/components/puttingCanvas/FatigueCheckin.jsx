export default function FatigueCheckin({ reason, onRespond }) {
  return (
    <section className="fatigue-checkin" role="dialog" aria-labelledby="fatigue-checkin-title">
      <h2 id="fatigue-checkin-title">Quick fatigue check</h2>
      <p>{reason === 'trailing_misses' ? 'A miss pattern appeared.' : 'Accuracy dropped from earlier stages.'} How tired do you feel?</p>
      <div className="fatigue-rating-row" aria-label="Fatigue rating">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button key={rating} type="button" className="chip" onClick={() => onRespond(rating)}>{rating}</button>
        ))}
      </div>
      <button type="button" className="link-button" onClick={() => onRespond(null)}>Skip</button>
    </section>
  )
}
