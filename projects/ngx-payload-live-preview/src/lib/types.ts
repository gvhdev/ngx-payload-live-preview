import type {Observable} from 'rxjs';
import type {PayloadLivePreviewService} from './service';

type UnwrapArray<T> = T extends Array<infer R> ? R : never;

type FieldTypes =
	| 'array'
	| 'blocks'
	| 'checkbox'
	| 'code'
	| 'collapsible'
	| 'confirmPassword'
	| 'date'
	| 'email'
	| 'group'
	| 'hidden'
	| 'number'
	| 'password'
	| 'point'
	| 'radio'
	| 'relationship'
	| 'richText'
	| 'row'
	| 'select'
	| 'tabs'
	| 'text'
	| 'textarea'
	| 'ui'
	| 'upload';

export type FieldSchemaJSON = {
	blocks?: FieldSchemaJSON;
	fields?: FieldSchemaJSON;
	hasMany?: boolean;
	name: string;
	relationTo?: string;
	slug?: string;
	type: FieldTypes;
}[];

export type PayloadRichTextHandlerArgs<T> = {
	depth?: number;
	fieldSchema: UnwrapArray<FieldSchemaJSON>;
	incomingData: T;
	population$: Observable<void>[];
	result: T;
	service: PayloadLivePreviewService;
};

export type PayloadRichTextHandler<T> = (
	args: PayloadRichTextHandlerArgs<T>,
) => void;
