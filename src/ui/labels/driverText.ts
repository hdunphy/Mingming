/**
 * TICKET 183h — a Totem's name and sentence as the screen prints them. The registry still calls
 * them drivers ("FIRE DRIVER"); this is the one place that says the new word for them.
 */
import { describeDriver } from '../../engine/data/driverRegistry';
import { plain } from './labels';

export function driverText(id: string): { readonly name: string; readonly description: string } {
    const { name, description } = describeDriver(id);
    return { name: plain(name), description: plain(description) };
}
