
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode> ← これを消す
    <App />
  // </React.StrictMode>, ← これも消す
)