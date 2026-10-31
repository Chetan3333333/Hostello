// The screen the owner sees while the app is fetching his data.
//
// Before this, that screen was one line of plain text ("Loading AccoHost
// Data...") on a blank page. Technically correct, but it reads as a broken
// page rather than a loading one, which is exactly the impression we cannot
// afford to give a hostel owner on the morning he collects rent.
//
// `dark` is passed on the two owner screens, because the owner login page and
// the owner dashboard are both dark. Without it the owner saw a white screen
// flash to dark the instant loading finished. The student and landing pages
// are light, so they use the plain version, which sets no background of its
// own and therefore cannot show the wrong colour on any page.
export default function AppLoading({ message = 'Loading your hostel…', dark = false }) {
  return (
    <div className={dark ? 'app-loading app-loading--dark' : 'app-loading'}>
      {/* alt is deliberately empty: the name is written out just below, so a
          screen reader announcing the logo too would say it twice. */}
      <img
        src="/logo.png"
        alt=""
        width="72"
        height="72"
        className="app-loading-logo"
        decoding="async"
        fetchPriority="high"
      />
      <div className="app-loading-name">AccoHost</div>
      <div className="app-loading-bar" role="progressbar" aria-label={message}><span /></div>
      <div className="app-loading-message">{message}</div>
    </div>
  );
}
