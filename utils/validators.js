import Joi from 'joi';

export const signupSchema = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(64).required()
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(64).required()
});

export const createDeviceSchema = Joi.object({
  code: Joi.string().trim().min(3).max(64).required(),
  name: Joi.string().trim().min(2).max(150).required(),
  location: Joi.string().allow('', null).max(200)
});

export const iotEventSchema = Joi.object({
  code: Joi.string().trim().required(),
  gas: Joi.number().min(0).required(),
  flame: Joi.number().min(0).required()
}).prefs({ abortEarly: false }).unknown(false);

export const heartbeatSchema = Joi.object({
  code: Joi.string().trim().required()
});

export const videoUploadSchema = Joi.object({
  title: Joi.string().trim().min(2).max(200).required(),
  description: Joi.string().allow('', null).max(1000)
});

export const fcmTokenSchema = Joi.object({
  token: Joi.string().trim().min(10).max(500).required(),
  device_type: Joi.string().valid('android', 'ios', 'web').default('android')
});
