import { boot } from 'quasar/wrappers';
import { initWebFileAPI } from '../services/web-file-api';

export default boot(() => {
  initWebFileAPI();
});
