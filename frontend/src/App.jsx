import { useEffect, useState } from 'react'
import { Link, Routes, Route } from 'react-router-dom'
import NotePage from './pages/notes/NotePage'
import Add from './pages/notes/Add'
import ViewNote from './pages/notes/ViewNote'
import LandingPage from './pages/LandingPage'
import ConnectPage from './pages/ConnectPage'
import ChatPage from './pages/ChatPage'
import { connectApi } from './api/client'

function RequireAuth({ children }) {
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let active = true
    connectApi.getSession()
      .then((session) => {
        if (active) setStatus(session.authenticated ? 'authenticated' : 'anonymous')
      })
      .catch(() => {
        if (active) setStatus('error')
      })
    return () => {
      active = false
    }
  }, [])

  if (status === 'loading') {
    return <main className="landingPage"><h1>Checking sign in...</h1></main>
  }
  if (status === 'anonymous') {
    return (
      <main className="landingPage">
        <h1>Sign in required</h1>
        <p>Sign in before using notes or chat.</p>
        <Link className="actionButton" to="/connect">Continue to sign in</Link>
      </main>
    )
  }
  if (status === 'error') {
    return (
      <main className="landingPage">
        <h1>Could not check your session</h1>
        <p>Please check your connection and try again.</p>
        <button className="actionButton" onClick={() => window.location.reload()} type="button">
          Retry
        </button>
      </main>
    )
  }
  return children
}

function App() {

  return (
    <>
      <Routes> 
        {/* LANDING PAGE LINK  */}
        <Route path='/' element={<LandingPage />}/>
        <Route path="/connect" element={<ConnectPage />} />
        {/* NOTES PAGE LINKS  */}
        <Route path="/note" element={<RequireAuth><NotePage /></RequireAuth>} />
        <Route path="/add_note" element={<RequireAuth><Add /></RequireAuth>} />
        <Route path="/edit_note/:id" element={<RequireAuth><Add /></RequireAuth>} />
        <Route path="/view_note/:id" element={<RequireAuth><ViewNote /></RequireAuth>} />
        <Route path="/chat" element={<RequireAuth><ChatPage /></RequireAuth>} />
      </Routes>
    </>
  )
}

export default App
