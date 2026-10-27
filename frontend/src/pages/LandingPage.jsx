import { Link } from "react-router-dom";
const LandingPage = () => {
    return (
        <div className="landingPage">
            <h1>Welcome to adva student tools</h1>
            <p>Try the following tools</p>

            <div className="tools">
                <Link to="/note" className="link">Notes</Link>
                <Link className="link">Feeds</Link>
                <Link className="link">Find Friends</Link>
                <Link to="/connect" className="link">Sign in / Connect by QR</Link>
                <Link to="/chat" className="link">Chat</Link>
                <Link className="link">Maps</Link>
            </div>
        </div>
    );
}
 
export default LandingPage;