import gamebank from 'gamebank'
import config from '../../config'
gamebank.api.setOptions({ url: 'http://192.168.1.88:8090' })
gamebank.config.set('address_prefix',config.address_prefix);
gamebank.config.set('chain_id',config.chain_id);
export default gamebank;