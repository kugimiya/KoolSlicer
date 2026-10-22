import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { useAppStore } from './store'

void useAppStore.getState().initClipper()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
