import {Routes, Route} from 'react-router-dom'
import NotePage from './pages/notes/NotePage'
import Add from './pages/notes/Add'
import ViewNote from './pages/notes/ViewNote'
import LandingPage from './pages/LandingPage'
import ConnectPage from './pages/ConnectPage'

function App() {

  return (
    <>
      <Routes> 
        {/* LANDING PAGE LINK  */}
        <Route path='/' element={<LandingPage />}/>
        <Route path="/connect" element={<ConnectPage />} />
        {/* NOTES PAGE LINKS  */}
        <Route path="/note" element={<NotePage />} /> 
        <Route path="/add_note" element={<Add />} />
        <Route path="/edit_note/:id" element={<Add />} />
        <Route path="/view_note/:id" element={<ViewNote />} />
      </Routes>
    </>
  )
}

export default App
