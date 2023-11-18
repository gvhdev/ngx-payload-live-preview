import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {
	Observable,
	catchError,
	filter,
	forkJoin,
	fromEvent,
	map,
	of,
	switchMap,
	tap,
	throwError,
} from 'rxjs';

import {
	PAYLOAD_API_ROUTE,
	PAYLOAD_RICH_TEXT_HANDLER,
	PAYLOAD_SERVER_URL,
} from './tokens';
import {FieldSchemaJSON} from './types';

@Injectable()
export class PayloadLivePreviewService {
	private readonly serverURL = inject(PAYLOAD_SERVER_URL);
	private readonly apiRoute = inject(PAYLOAD_API_ROUTE, {optional: true});
	private readonly richTextHandler = inject(PAYLOAD_RICH_TEXT_HANDLER, {
		optional: true,
	});
	private readonly httpClient = inject(HttpClient);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private base$: Observable<any>;

	constructor() {
		this.base$ = fromEvent<MessageEvent>(window, 'message').pipe(
			filter((event) => event.origin === this.serverURL && event.data),
			map((event) => JSON.parse(event.data)),
			catchError((error) => {
				if (error instanceof SyntaxError) {
					return of(undefined);
				} else {
					return throwError(() => error);
				}
			}),
			filter((eventData) => eventData?.type === 'payload-live-preview'),
		);
	}

	ready(): void {
		const windowToPostTo: Window = window.opener || window.parent;

		windowToPostTo?.postMessage(
			JSON.stringify({
				ready: true,
				type: 'payload-live-preview',
			}),
			this.serverURL,
		);
	}

	data$<T>(initialData: T, depth?: number): Observable<T> {
		let fieldSchema: FieldSchemaJSON;

		return this.base$.pipe(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			tap((eventData: any) => {
				if (!fieldSchema && eventData.fieldSchemaJSON) {
					fieldSchema = eventData.fieldSchemaJSON;
				}
			}),
			switchMap((eventData) => {
				if (!fieldSchema) {
					console.warn(
						'Payload Live Preview: No `fieldSchemaJSON` was received from the parent window. Unable to merge data.',
					);
					return of(initialData);
				} else {
					return this.populate<T>({
						depth,
						fieldSchema,
						incomingData: eventData.data,
						initialData,
					});
				}
			}),
		);
	}

	populate<T>(args: {
		depth?: number;
		fieldSchema: FieldSchemaJSON;
		incomingData: Partial<T>;
		initialData: T;
	}): Observable<T> {
		const {depth, fieldSchema, incomingData, initialData} = args;

		const result = {...initialData};

		const population$: Observable<void>[] = [];

		this.traverseFields({
			depth,
			fieldSchema,
			incomingData,
			population$,
			result,
		});

		if (population$.length === 0) {
			return of(result);
		}

		return forkJoin(population$).pipe(map(() => result));
	}

	traverseFields<T>(args: {
		depth?: number;
		fieldSchema: FieldSchemaJSON;
		incomingData: T;
		population$: Observable<void>[];
		result: T;
	}): void {
		const {
			depth,
			fieldSchema: fieldSchemas,
			incomingData,
			population$,
			result,
		} = args;

		fieldSchemas.forEach((fieldSchema) => {
			if ('name' in fieldSchema && typeof fieldSchema.name === 'string') {
				const fieldName = fieldSchema.name;

				switch (fieldSchema.type) {
					case 'array':
						if (Array.isArray(incomingData[fieldName])) {
							result[fieldName] = incomingData[fieldName].map(
								(incomingRow, i) => {
									if (!result[fieldName]) {
										result[fieldName] = [];
									}

									if (!result[fieldName][i]) {
										result[fieldName][i] = {};
									}

									this.traverseFields({
										depth,
										fieldSchema: fieldSchema.fields!,
										incomingData: incomingRow,
										population$,
										result: result[fieldName][i],
									});

									return result[fieldName][i];
								},
							);
						}
						break;

					case 'blocks':
						if (Array.isArray(incomingData[fieldName])) {
							result[fieldName] = incomingData[fieldName].map(
								(incomingBlock, i) => {
									const incomingBlockJSON =
										fieldSchema.blocks![
											incomingBlock.blockType
										];

									if (!result[fieldName]) {
										result[fieldName] = [];
									}

									if (
										!result[fieldName][i] ||
										result[fieldName][i].id !==
											incomingBlock.id ||
										result[fieldName][i].blockType !==
											incomingBlock.blockType
									) {
										result[fieldName][i] = {
											blockType: incomingBlock.blockType,
										};
									}

									this.traverseFields({
										depth,
										fieldSchema: incomingBlockJSON.fields!,
										incomingData: incomingBlock,
										population$,
										result: result[fieldName][i],
									});

									return result[fieldName][i];
								},
							);
						} else {
							result[fieldName] = [];
						}

						break;

					case 'tabs':
					case 'group':
						if (!result[fieldName]) {
							result[fieldName] = {};
						}

						this.traverseFields({
							depth,
							fieldSchema: fieldSchema.fields!,
							incomingData: incomingData[fieldName] || {},
							population$,
							result: result[fieldName],
						});

						break;

					case 'upload':
					case 'relationship':
						// Handle `hasMany` relationships
						if (
							fieldSchema.hasMany &&
							Array.isArray(incomingData[fieldName])
						) {
							if (!result[fieldName]) {
								result[fieldName] = [];
							}

							incomingData[fieldName].forEach(
								(incomingRelation, i) => {
									// Handle `hasMany` polymorphic
									if (Array.isArray(fieldSchema.relationTo)) {
										// if the field doesn't exist on the result, create it
										// the value will be populated later
										if (!result[fieldName][i]) {
											result[fieldName][i] = {
												relationTo:
													incomingRelation.relationTo,
											};
										}

										const oldID =
											result[fieldName][i]?.value?.id;
										const oldRelation =
											result[fieldName][i]?.relationTo;
										const newID = incomingRelation.value;
										const newRelation =
											incomingRelation.relationTo;

										if (
											oldID !== newID ||
											oldRelation !== newRelation
										) {
											population$.push(
												this.fetch({
													id: incomingRelation.value,
													accessor: 'value',
													collection: newRelation,
													depth: depth || 0,
													ref: result[fieldName][i],
												}),
											);
										}
									} else {
										// Handle `hasMany` monomorphic
										if (
											result[fieldName][i]?.id !==
											incomingRelation
										) {
											population$.push(
												this.fetch({
													id: incomingRelation,
													accessor: i,
													collection: String(
														fieldSchema.relationTo,
													),
													depth: depth || 0,
													ref: result[fieldName],
												}),
											);
										}
									}
								},
							);
						} else {
							// Handle `hasOne` polymorphic
							if (Array.isArray(fieldSchema.relationTo)) {
								// if the field doesn't exist on the result, create it
								// the value will be populated later
								if (!result[fieldName]) {
									result[fieldName] = {
										relationTo:
											incomingData[fieldName]?.relationTo,
									};
								}

								const hasNewValue =
									incomingData[fieldName] &&
									typeof incomingData[fieldName] ===
										'object' &&
									incomingData[fieldName] !== null;

								const hasOldValue =
									result[fieldName] &&
									typeof result[fieldName] === 'object' &&
									result[fieldName] !== null;

								const newID = hasNewValue
									? typeof incomingData[fieldName].value ===
									  'object'
										? incomingData[fieldName].value.id
										: incomingData[fieldName].value
									: '';

								const oldID = hasOldValue
									? typeof result[fieldName].value ===
									  'object'
										? result[fieldName].value.id
										: result[fieldName].value
									: '';

								const newRelation = hasNewValue
									? incomingData[fieldName].relationTo
									: '';
								const oldRelation = hasOldValue
									? result[fieldName].relationTo
									: '';

								// if the new value/relation is different from the old value/relation
								// populate the new value, otherwise leave it alone
								if (
									newID !== oldID ||
									newRelation !== oldRelation
								) {
									// if the new value is not empty, populate it
									// otherwise set the value to null
									if (newID) {
										population$.push(
											this.fetch({
												id: newID,
												accessor: 'value',
												collection: newRelation,
												depth: depth || 0,
												ref: result[fieldName],
											}),
										);
									} else {
										result[fieldName] = null;
									}
								}
							} else {
								// Handle `hasOne` monomorphic
								const newID: number | string | undefined =
									(incomingData[fieldName] &&
										typeof incomingData[fieldName] ===
											'object' &&
										incomingData[fieldName].id) ||
									incomingData[fieldName];

								const oldID: number | string | undefined =
									(result[fieldName] &&
										typeof result[fieldName] === 'object' &&
										result[fieldName].id) ||
									result[fieldName];

								// if the new value is different from the old value
								// populate the new value, otherwise leave it alone
								if (newID !== oldID) {
									// if the new value is not empty, populate it
									// otherwise set the value to null
									if (newID) {
										population$.push(
											this.fetch({
												id: newID,
												accessor: fieldName,
												collection: String(
													fieldSchema.relationTo,
												),
												depth: depth || 0,
												ref: result as Record<
													string,
													unknown
												>,
											}),
										);
									} else {
										result[fieldName] = null;
									}
								}
							}
						}

						break;

					case 'richText':
						if (this.richTextHandler) {
							this.richTextHandler({
								depth,
								fieldSchema: fieldSchema,
								incomingData: incomingData,
								population$,
								result: result,
								service: this,
							});
						} else {
							result[fieldName] = incomingData[fieldName];
						}

						break;

					default:
						result[fieldName] = incomingData[fieldName];
				}
			}
		});
	}

	fetch(args: {
		accessor: number | string;
		collection: string;
		depth: number;
		id: number | string;
		ref: Record<string, unknown>;
	}): Observable<void> {
		const {id, accessor, collection, depth, ref} = args;

		const url = `${this.serverURL}${
			this.apiRoute || '/api'
		}/${collection}/${id}?depth=${depth}`;

		return this.httpClient
			.get(url, {
				withCredentials: true,
				headers: {
					'Content-Type': 'application/json',
				},
			})
			.pipe(
				tap((res) => {
					ref[accessor] = res;
				}),
				map(() => undefined),
				catchError((err) => {
					console.error(err);
					return of(undefined);
				}),
			);
	}
}
