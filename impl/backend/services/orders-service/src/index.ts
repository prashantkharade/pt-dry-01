import './preload';
import 'reflect-metadata';
import { Application } from './app';

Application.instance().start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
