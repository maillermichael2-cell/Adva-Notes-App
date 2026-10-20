import {Routes, Route} from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Add from './pages/Add'
import ViewNote from './pages/ViewNote'

function App() {

  return (
    <>
      <Routes> 
        <Route path="/" element={<LandingPage />} /> 
        <Route path="/add_org" element={<Add />} />
        <Route path="/edit_org/:id" element={<Add />} />
        <Route path="/view_note/:id" element={<ViewNote />} />
      </Routes>
    </>
  )
}

export default App
