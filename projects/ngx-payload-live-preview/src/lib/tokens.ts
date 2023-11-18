import {InjectionToken} from '@angular/core';
import type {PayloadRichTextHandler} from './types';

export const PAYLOAD_SERVER_URL = new InjectionToken<string>(
	'payload_server_url',
);

export const PAYLOAD_API_ROUTE = new InjectionToken<string>(
	'payload_api_route',
);

export const PAYLOAD_RICH_TEXT_HANDLER = new InjectionToken<
	PayloadRichTextHandler<unknown>
>('payload_rich_text_handler');
