// App.jsx

import { Routes, Route } from 'react-router-dom'
import Hub from './pages/hub.jsx'
import Article from './pages/article.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Hub />} />
      <Route path="/article/:id" element={<Article />} />
    </Routes>
  )
}

export default App