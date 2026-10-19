import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import '@fontsource/caveat/500.css'
import '@fontsource/lora/400.css'
import '@fontsource/jetbrains-mono/400.css'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
