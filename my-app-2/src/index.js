import { createRoot } from 'react-dom/client';
import './index.css';
import AItest from './AItest.js';

//const root = ReactDOM.createRoot(document.getElementById('root'));


const el = document.getElementById('react-root');
if (el) {
  createRoot(el).render(<AItest />);
}


// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals


