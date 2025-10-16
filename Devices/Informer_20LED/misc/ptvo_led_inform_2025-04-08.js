const zigbeeHerdsmanConverters = require('zigbee-herdsman-converters');
const zigbeeHerdsmanUtils = require('zigbee-herdsman-converters/lib/utils');


const exposes = zigbeeHerdsmanConverters['exposes'] || require("zigbee-herdsman-converters/lib/exposes");
const ea = exposes.access;
const e = exposes.presets;
const modernExposes = (e.hasOwnProperty('illuminance_lux'))? false: true;

const fz = zigbeeHerdsmanConverters.fromZigbeeConverters || zigbeeHerdsmanConverters.fromZigbee;
const tz = zigbeeHerdsmanConverters.toZigbeeConverters || zigbeeHerdsmanConverters.toZigbee;

const ptvo_switch = (zigbeeHerdsmanConverters.findByModel)?zigbeeHerdsmanConverters.findByModel('ptvo.switch'):zigbeeHerdsmanConverters.findByDevice({modelID: 'ptvo.switch'});
fz.ptvo_on_off = {
  cluster: 'genOnOff',
  type: ['attributeReport', 'readResponse'],
  convert: (model, msg, publish, options, meta) => {
      if (msg.data.hasOwnProperty('onOff')) {
          const channel = msg.endpoint.ID;
          const endpointName = `l${channel}`;
          const binaryEndpoint = model.meta && model.meta.binaryEndpoints && model.meta.binaryEndpoints[endpointName];
          const prefix = (binaryEndpoint) ? model.meta.binaryEndpoints[endpointName] : 'state';
          const property = `${prefix}_${endpointName}`;
	  if (binaryEndpoint) {
            return {[property]: msg.data['onOff'] === 1};
          }
          return {[property]: msg.data['onOff'] === 1 ? 'ON' : 'OFF'};
      }
  },
};

const ptvo_pattern_control = (endpoint) => {
  const control = exposes.switch().withState('state', true, 'Pattern auto-change').withEndpoint(endpoint);
  control.features.push(exposes.numeric(endpoint, ea.ALL).withDescription('Pattern number'));
  return control;
};

const ptvo_pattern_shortcut = (endpoint) => {
  const control = exposes.switch().withState('state', true, 'Activate pattern').withEndpoint(endpoint);
  control.features.push(exposes.numeric(endpoint, ea.ALL).withDescription('Pattern number'));
  return control;
};


const switchTypesList = {
    'switch': 0x00,
    'single click': 0x01,
    'multi-click': 0x02,
    'reset to defaults': 0xff,
};

const switchActionsList = {
    on: 0x00,
    off: 0x01,
    toggle: 0x02,
};

const inputLinkList = {
    no: 0x00,
    yes: 0x01,
};

const bindCommandList = {
    'on/off': 0x00,
    'toggle': 0x01,
    'change level up': 0x02,
    'change level down': 0x03,
    'change level up with off': 0x04,
    'change level down with off': 0x05,
    'recall scene 0': 0x06,
    'recall scene 1': 0x07,
    'recall scene 2': 0x08,
    'recall scene 3': 0x09,
    'recall scene 4': 0x0A,
    'recall scene 5': 0x0B,
    'dimmer': 0x0C,
    'dimmer (hue)': 0x0D,
    'dimmer (saturation)': 0x0E,
    'dimmer (color temperature)': 0x0F,
    'intruder alarm systems (ias)': 0x20,
};

function getSortedList(source) {
    const keysSorted = [];
    for (const key in source) {
        keysSorted.push([key, source[key]]);
    }

    keysSorted.sort(function(a, b) {
        return a[1] - b[1];
    });

    const result = [];
    keysSorted.forEach((item) => {
        result.push(item[0]);
    });
    return result;
}

function getListValueByKey(source, value) {
    const intVal = parseInt(value, 10);
    return source.hasOwnProperty(value) ? source[value] : intVal;
}

const getKey = (object, value) => {
    for (const key in object) {
        if (object[key] == value) return key;
    }
};

tz.ptvo_on_off_config = {
    key: ['switch_type', 'switch_actions', 'link_to_output', 'bind_command'],
    convertGet: async (entity, key, meta) => {
        await entity.read('genOnOffSwitchCfg', ['switchType', 'switchActions', 0x4001, 0x4002]);
    },
    convertSet: async (entity, key, value, meta) => {
        let payload;
        let data;
        switch (key) {
        case 'switch_type':
            data = getListValueByKey(switchTypesList, value);
            payload = {switchType: data};
            break;
        case 'switch_actions':
            data = getListValueByKey(switchActionsList, value);
            payload = {switchActions: data};
            break;
        case 'link_to_output':
            data = getListValueByKey(inputLinkList, value);
            payload = {0x4001: {value: data, type: 32 /* uint8 */}};
            break;
        case 'bind_command':
            data = getListValueByKey(bindCommandList, value);
            payload = {0x4002: {value: data, type: 32 /* uint8 */}};
            break;
        }
        await entity.write('genOnOffSwitchCfg', payload);
    },
};

fz.ptvo_on_off_config = {
    cluster: 'genOnOffSwitchCfg',
    type: ['readResponse', 'attributeReport'],
    convert: (model, msg, publish, options, meta) => {
        const channel = getKey(model.endpoint(msg.device), msg.endpoint.ID);
        const {switchActions, switchType} = msg.data;
        const inputLink = msg.data[0x4001];
        const bindCommand = msg.data[0x4002];
        return {
            [`switch_type_${channel}`]: getKey(switchTypesList, switchType),
            [`switch_actions_${channel}`]: getKey(switchActionsList, switchActions),
            [`link_to_output_${channel}`]: getKey(inputLinkList, inputLink),
            [`bind_command_${channel}`]: getKey(bindCommandList, bindCommand),
        };
    },
};

function ptvo_on_off_config_exposes(epName) {
    const features = [];
    features.push(exposes.enum('switch_type', exposes.access.ALL,
        getSortedList(switchTypesList)).withEndpoint(epName));
    features.push(exposes.enum('switch_actions', exposes.access.ALL,
        getSortedList(switchActionsList)).withEndpoint(epName));
    features.push(exposes.enum('link_to_output', exposes.access.ALL,
        getSortedList(inputLinkList)).withEndpoint(epName));
    features.push(exposes.enum('bind_command', exposes.access.ALL,
        getSortedList(bindCommandList)).withEndpoint(epName));
    return features;
}




const device = {
    zigbeeModel: ['ptvo_led_inform'],
    model: 'ptvo_led_inform',
    vendor: 'modkam.ru',
    description: '[Configurable firmware](https://ptvo.info/zigbee-configurable-firmware-features/)',
    fromZigbee: [fz.ignore_basic_report, fz.ptvo_switch_analog_input, fz.brightness, fz.ptvo_on_off, fz.color_colortemp, fz.ptvo_multistate_action, fz.ptvo_on_off_config,],
    toZigbee: [tz.ptvo_switch_trigger, tz.on_off, tz.ptvo_switch_analog_input, tz.ptvo_switch_light_brightness, tz.light_color, tz.ptvo_on_off_config,],
    exposes: [e.light_brightness_colorxy().withEndpoint('l1'),
      ptvo_pattern_control('l2'),
      ptvo_pattern_shortcut('l3'),
      ptvo_pattern_shortcut('l4'),
      ptvo_pattern_shortcut('l5'),
      ptvo_pattern_shortcut('l6'),
      ptvo_pattern_shortcut('l7'),
      ptvo_pattern_shortcut('l8'),
      e.action(['single', 'double', 'triple', 'hold', 'release']),
      ...ptvo_on_off_config_exposes('l1'),
],
    meta: {
        multiEndpoint: true,
        enhancedHue: false, 
    },
    endpoint: (device) => {
        return {
            l1: 1, l2: 2, l3: 3, l4: 4, l5: 5, l6: 6, l7: 7, l8: 8,
        };
    },
    configure: async (device, coordinatorEndpoint, logger) => {
      const endpoint = device.getEndpoint(1);
      await endpoint.read('genBasic', ['modelId', 'swBuildId', 'powerSource']);
    },

};

module.exports = device;
