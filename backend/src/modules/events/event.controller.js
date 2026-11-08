import { asyncHandler } from '../../utils/async-handler.js';
import * as eventService from './event.service.js';

export const createEvent = asyncHandler(async (req, res) => {
  const event = await eventService.createEvent(req.body, req.user.id);
  res.status(201).json({ data: { event } });
});

export const listEvents = asyncHandler(async (req, res) => {
  const events = await eventService.listEvents(req.validatedQuery ?? {});
  res.status(200).json({ data: { events } });
});

export const getEvent = asyncHandler(async (req, res) => {
  const event = await eventService.getEventById(req.params.id);
  res.status(200).json({ data: { event } });
});

export const getEventInventory = asyncHandler(async (req, res) => {
  const inventory = await eventService.getEventInventory(req.params.id);
  res.status(200).json({ data: { inventory } });
});
