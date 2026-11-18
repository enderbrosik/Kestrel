import './styles/main.css';
import { mountApp } from './app';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');
mountApp(root);
