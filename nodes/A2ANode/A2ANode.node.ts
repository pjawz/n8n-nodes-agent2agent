import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	JsonObject,
	NodeParameterValue,
	// Assuming credential type is defined elsewhere, e.g.
	// ICredentialDataDecryptedObject,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

// Placeholder interface for your actual credential data structure
interface IA2ACredential {
	// Example: Define fields based on your credential type(s)
	apiKey?: string;
	bearerToken?: string;
	// Add fields for OAuth2 etc. if implementing
}

export class Agent2Agent implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Agent2Agent',
		name: 'agent2agent', // Internal node name (lowercase)
		icon: 'file:Agent2Agent.svg', // Reference an SVG icon file
		group: ['ai'], // Categorize under AI group
		version: 1,
		subtitle: '={{$parameter["operation"]}}', // Display selected operation dynamically
		description:
			"Interacts with AI agents using Google's Agent2Agent (A2A) protocol. Send tasks, manage interactions, and process results.",
		defaults: {
			name: 'Agent2Agent',
		},
		inputs: ['main'], // Standard input
		outputs: ['main'], // Standard output
		// Define required credentials - REPLACE 'a2aApi' with your actual credential name
		credentials: [
			{
				name: 'a2aApi', // <<< MUST MATCH your credential definition file (e.g., A2ACredentials.credentials.ts)
				required: true,
				// You might add displayOptions here if needed based on credential type complexity
			},
		],
		properties: [
			// Operation Selector
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true, // Prevents expression evaluation for this field
				options: [
					{
						name: 'Discover Agent',
						value: 'discoverAgent',
						action: 'Discover agent capabilities via agent card',
						description: "Fetch the agent's Agent Card metadata",
					},
					{
						name: 'Send Task',
						value: 'sendTask',
						action: 'Send a task or message to an agent',
						description: 'Initiate or continue a task with an agent',
					},
					{
						name: 'Get Task',
						value: 'getTask',
						action: 'Get status and results of a task',
						description: 'Retrieve details for a previously submitted task',
					},
					{
						name: 'Cancel Task',
						value: 'cancelTask',
						action: 'Cancel an ongoing task',
						description: 'Request cancellation of an active task',
					},
				],
				default: 'sendTask',
			},

			// --- Common Properties ---
			{
				displayName: 'Agent Base URL',
				name: 'agentUrl',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://example-agent.com',
				description: 'The base URL of the target A2A agent server',
				// Display condition could be added if needed, but likely always required
			},

			// --- Discover Agent Properties ---
			// (No specific properties needed for basic discovery)

			// --- Send Task Properties ---
			{
				displayName: 'Task ID',
				name: 'taskId',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['sendTask'],
					},
				},
				placeholder: '(Optional) Existing Task ID to continue interaction',
				description:
					'Optional. Provide an existing Task ID to send a follow-up message. If empty, a new Task ID will be generated.',
			},
			{
				displayName: 'Message Parts',
				name: 'messageParts',
				type: 'fixedCollection',
				displayOptions: {
					show: {
						operation: ['sendTask'],
					},
				},
				placeholder: 'Add Message Part',
				description: 'Define the content parts of the message to send',
				typeOptions: {
					multipleValues: true, // Allow multiple parts
				},
				default: {}, // Default needs to be empty object
				options: [
					{
						displayName: 'Part Details',
						name: 'part',
						values: [
							{
								displayName: 'Part Type',
								name: 'partType',
								type: 'options',
								options: [
									{ name: 'Text', value: 'text' },
									{ name: 'Data (JSON)', value: 'data' },
									{ name: 'File (Binary/URI)', value: 'file' },
								],
								default: 'text',
								description: 'The type of content for this part',
							},
							{
								displayName: 'Text Content',
								name: 'textContent',
								type: 'string',
								displayOptions: { show: { partType: ['text'] } },
								default: '',
								placeholder: 'Enter text or use an expression {{ $json... }}',
								description: 'The text content for this part',
							},
							{
								displayName: 'JSON Data Content',
								name: 'jsonDataContent',
								type: 'json',
								displayOptions: { show: { partType: ['data'] } },
								default: '',
								placeholder: 'Enter JSON or use an expression {{ $json... }}',
								description: 'The JSON data content for this part',
							},
							{
								displayName: 'File Source',
								name: 'fileSource',
								type: 'options',
								displayOptions: { show: { partType: ['file'] } },
								options: [
									{ name: 'Input Binary Data', value: 'binary' },
									{ name: 'Public URI', value: 'uri' },
									// { name: 'Inline Base64 (Advanced)', value: 'base64' }, // Option?
								],
								default: 'binary',
								description: 'Where to get the file content from',
							},
							{
								displayName: 'Input Binary Property',
								name: 'fileBinaryProperty',
								type: 'string',
								displayOptions: {
									show: {
										partType: ['file'],
										fileSource: ['binary'],
									},
								},
								default: 'data', // Default binary property name in n8n
								placeholder: 'data',
								description:
									'Name of the binary property containing the file data from the input item',
							},
							{
								displayName: 'File URI',
								name: 'fileUri',
								type: 'string',
								displayOptions: {
									show: {
										partType: ['file'],
										fileSource: ['uri'],
									},
								},
								default: '',
								placeholder: 'https://example.com/file.pdf',
								description: 'Publicly accessible URL of the file',
							},
							{
								displayName: 'MIME Type',
								name: 'fileMimeType',
								type: 'string',
								displayOptions: { show: { partType: ['file'] } },
								default: 'application/octet-stream',
								placeholder: 'image/png',
								description: 'The MIME type of the file (e.g., application/pdf, image/jpeg)',
							},
						],
					},
				],
			},
			{
				displayName: 'Wait for Completion',
				name: 'waitForCompletion',
				type: 'boolean',
				displayOptions: {
					show: {
						operation: ['sendTask'],
					},
				},
				default: false,
				description:
					'Whether the node should wait until the task reaches a final state (completed, failed, canceled)',
			},
			{
				displayName: 'Timeout (Seconds)',
				name: 'timeoutSeconds',
				type: 'number',
				displayOptions: {
					show: {
						operation: ['sendTask'],
						waitForCompletion: [true],
					},
				},
				default: 60,
				description: 'Maximum time to wait for task completion before timing out',
			},
			{
				displayName: 'Polling Interval (Seconds)',
				name: 'pollingIntervalSeconds',
				type: 'number',
				displayOptions: {
					show: {
						operation: ['sendTask'],
						waitForCompletion: [true],
					},
				},
				default: 5,
				description: 'How often to check the task status when waiting (minimum 1 second)',
			},
			{
				displayName: 'Metadata (JSON)',
				name: 'metadata',
				type: 'json',
				displayOptions: {
					show: {
						operation: ['sendTask'],
					},
				},
				default: '{}',
				placeholder: '{"key": "value"}',
				description: 'Optional JSON metadata to send with the task request',
			},

			// --- Get Task Properties ---
			{
				displayName: 'Task ID',
				name: 'taskId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['getTask', 'cancelTask'], // Also used for Cancel Task
					},
				},
				placeholder: 'Enter the Task ID to retrieve or cancel',
				description: 'The unique ID of the task to get status for or cancel',
			},
			// Add historyLength param for Get Task? (Optional A2A feature)
			// {
			// 	displayName: 'History Length',
			// 	name: 'historyLength',
			// 	type: 'number',
			// 	displayOptions: {
			// 		show: {
			// 			operation: ['getTask'],
			// 		},
			// 	},
			// 	default: 10,
			// 	description: 'Maximum number of history messages to retrieve',
			// },

			// --- Cancel Task Properties ---
			// (Uses taskId defined above)
		],
	};

	// ---------------
	//    EXECUTE
	// ---------------
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string; // Assume operation is same for all items for simplicity now

		// Get credentials - REPLACE 'a2aApi' with your actual credential name
		const credentials = (await this.getCredentials('a2aApi')) as IA2ACredential; // <<< MUST MATCH CREDENTIAL NAME

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const agentUrl = this.getNodeParameter('agentUrl', itemIndex) as string;
				let taskId = this.getNodeParameter('taskId', itemIndex, '') as string | undefined;
				if (taskId === '') taskId = undefined; // Treat empty string as undefined

				// ------------- Discover Agent -------------
				if (operation === 'discoverAgent') {
					const discoveryUrl = new URL('/.well-known/agent.json', agentUrl).toString();
					const options = {
						method: 'GET',
						uri: discoveryUrl,
						json: true, // Expect JSON response
						headers: {
							Accept: 'application/json',
						},
					};
					const response = await this.helpers.httpRequest(options);
					returnData.push({ json: response as JsonObject, pairedItem: itemIndex });
				}

				// ------------- Send Task -------------
				else if (operation === 'sendTask') {
					const messagePartsRaw = this.getNodeParameter('messageParts', itemIndex) as {
						part: any;
					}; // Type definition needed
					const waitForCompletion = this.getNodeParameter(
						'waitForCompletion',
						itemIndex,
					) as boolean;
					const metadataParam = this.getNodeParameter('metadata', itemIndex, '{}') as string;
					let metadata = {};
					try {
						metadata = JSON.parse(metadataParam);
					} catch (e) {
						throw new NodeOperationError(
							this.getNode(),
							`Invalid JSON in Metadata parameter: ${e.message}`,
							{ itemIndex },
						);
					}

					// Generate Task ID if not provided
					const effectiveTaskId = taskId ?? crypto.randomUUID();

					// Construct A2A message parts
					const parts: any[] = []; // Define proper type later
					if (messagePartsRaw.part && Array.isArray(messagePartsRaw.part)) {
						for (const p of messagePartsRaw.part) {
							const partType = p.partType;
							if (partType === 'text') {
								parts.push({ type: 'text', text: p.textContent });
							} else if (partType === 'data') {
								try {
									const data = JSON.parse(p.jsonDataContent);
									parts.push({ type: 'data', data: data });
								} catch (e) {
									throw new NodeOperationError(
										this.getNode(),
										`Invalid JSON in Data Part Content: ${e.message}`,
										{ itemIndex },
									);
								}
							} else if (partType === 'file') {
								const fileSource = p.fileSource;
								const mimeType = p.fileMimeType || 'application/octet-stream';
								if (fileSource === 'uri') {
									parts.push({ type: 'file', file: { uri: p.fileUri, mimeType: mimeType } });
								} else if (fileSource === 'binary') {
									const binaryPropertyName = p.fileBinaryProperty || 'data';
									const binaryData = await this.helpers.getBinaryData(
										itemIndex,
										binaryPropertyName,
									);
									parts.push({
										type: 'file',
										file: { bytes: binaryData.toString('base64'), mimeType: mimeType },
									}); // Send as Base64 inline
								}
								// else if (fileSource === 'base64') { ... } // Handle direct base64 input if needed
							}
						}
					} else {
						throw new NodeOperationError(
							this.getNode(),
							'Message Parts parameter is missing or invalid',
							{
								itemIndex,
							},
						);
					}

					// Construct JSON-RPC request body for tasks/send
					const requestBody = this.buildJsonRpcRequest('tasks/send', {
						id: effectiveTaskId,
						message: { role: 'user', parts: parts },
						metadata: metadata,
					});

					// Make the initial HTTP request
					let taskResult = await this.makeA2ARequest(agentUrl, requestBody, credentials, itemIndex);

					// Handle waiting for completion
					if (waitForCompletion && taskResult?.status?.state) {
						const timeoutSeconds = this.getNodeParameter('timeoutSeconds', itemIndex, 60) as number;
						let pollingIntervalSeconds = this.getNodeParameter(
							'pollingIntervalSeconds',
							itemIndex,
							5,
						) as number;
						if (pollingIntervalSeconds < 1) pollingIntervalSeconds = 1; // Minimum interval

						const startTime = Date.now();
						const timeoutMs = timeoutSeconds * 1000;

						while (
							['submitted', 'working', 'input-required'].includes(taskResult.status.state) &&
							Date.now() - startTime < timeoutMs
						) {
							// Wait before polling again
							await new Promise((resolve) => setTimeout(resolve, pollingIntervalSeconds * 1000));

							// Check timeout before making next request
							if (Date.now() - startTime >= timeoutMs) {
								throw new NodeOperationError(
									this.getNode(),
									`Task timed out after ${timeoutSeconds} seconds waiting for completion. Last state: ${taskResult.status.state}`,
									{ itemIndex },
								);
							}

							// Poll using tasks/get
							const getTaskBody = this.buildJsonRpcRequest('tasks/get', {
								id: taskResult.id, // Use the ID from the *task* response
								// historyLength: 0 // Don't need history during polling maybe?
							});
							taskResult = await this.makeA2ARequest(agentUrl, getTaskBody, credentials, itemIndex);

							// Check if status exists after polling
							if (!taskResult?.status?.state) {
								throw new NodeOperationError(
									this.getNode(),
									'Polling Error: Received invalid task status during wait.',
									{ itemIndex },
								);
							}
						} // end while loop

						// Final check after loop (in case it completed exactly on last poll)
						if (['submitted', 'working', 'input-required'].includes(taskResult.status.state)) {
							throw new NodeOperationError(
								this.getNode(),
								`Task timed out after ${timeoutSeconds} seconds. Final polled state: ${taskResult.status.state}`,
								{ itemIndex },
							);
						}
					} // end if waitForCompletion

					// Prepare output data (parse artifacts)
					const outputItem = await this.prepareOutputData(taskResult, itemIndex);
					returnData.push(outputItem);
				}

				// ------------- Get Task -------------
				else if (operation === 'getTask') {
					if (!taskId)
						throw new NodeOperationError(
							this.getNode(),
							'Task ID parameter is required for Get Task',
							{
								itemIndex,
							},
						);
					const requestBody = this.buildJsonRpcRequest('tasks/get', { id: taskId });
					const taskResult = await this.makeA2ARequest(
						agentUrl,
						requestBody,
						credentials,
						itemIndex,
					);
					const outputItem = await this.prepareOutputData(taskResult, itemIndex);
					returnData.push(outputItem);
				}

				// ------------- Cancel Task -------------
				else if (operation === 'cancelTask') {
					if (!taskId)
						throw new NodeOperationError(
							this.getNode(),
							'Task ID parameter is required for Cancel Task',
							{ itemIndex },
						);
					const requestBody = this.buildJsonRpcRequest('tasks/cancel', { id: taskId });
					const taskResult = await this.makeA2ARequest(
						agentUrl,
						requestBody,
						credentials,
						itemIndex,
					);
					const outputItem = await this.prepareOutputData(taskResult, itemIndex); // Return the cancellation confirmation task state
					returnData.push(outputItem);
				}

				// ------------- Unknown Operation -------------
				else {
					throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, {
						itemIndex,
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: items[itemIndex].json, // Keep original input JSON
						error:
							error instanceof NodeOperationError
								? error
								: new NodeOperationError(this.getNode(), error, { itemIndex }), // Ensure it's a NodeOperationError
						pairedItem: itemIndex,
					});
				} else {
					// Ensure proper error context even if not NodeOperationError initially
					if (error instanceof NodeOperationError) {
						throw error; // Re-throw if already correctly formatted
					}
					throw new NodeOperationError(this.getNode(), error, { itemIndex });
				}
			}
		} // end for loop

		return [returnData];
	}

	// --- Helper Functions ---

	/**
	 * Builds a standard JSON-RPC 2.0 request object.
	 */
	private buildJsonRpcRequest(method: string, params: JsonObject): JsonObject {
		return {
			jsonrpc: '2.0',
			id: crypto.randomUUID(), // Generate unique request ID
			method: method,
			params: params,
		};
	}

	/**
	 * Makes the HTTP request to the A2A agent, handling basic auth and response checking.
	 * Needs refinement for different auth types and more robust error handling.
	 */
	public async makeA2ARequest(
		agentUrl: string,
		requestBody: JsonObject,
		credentials: IA2ACredential,
		itemIndex: number,
	): Promise<any> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			Accept: 'application/json',
		};

		// --- Basic Authentication Handling (Example) ---
		// This needs to be expanded based on your actual credential types
		if (credentials.apiKey) {
			headers['X-API-Key'] = credentials.apiKey; // Example header name
		} else if (credentials.bearerToken) {
			headers['Authorization'] = `Bearer ${credentials.bearerToken}`;
		}
		// Add logic for OAuth2 token fetching/refreshing if implemented
		// --- End Authentication Handling ---

		const options = {
			method: 'POST',
			uri: agentUrl, // Send requests to the base URL
			body: requestBody,
			headers: headers,
			json: true, // Send as JSON, expect JSON response
			// Consider adding timeout, rejectUnauthorized etc. based on node settings/needs
			// returnFullResponse: true // Might be needed for detailed error handling
		};

		try {
			const response = (await this.helpers.httpRequest(options)) as JsonObject;

			// Check for JSON-RPC level error
			if (response.error) {
				const errorDetails = response.error as { code?: number; message?: string; data?: any };
				throw new NodeOperationError(
					this.getNode(),
					`A2A Agent Error: ${errorDetails.message || 'Unknown error'} (Code: ${errorDetails.code ?? 'N/A'})`,
					{ itemIndex, errorData: errorDetails.data },
				);
			}

			// Check if result exists (should for success)
			if (!response.result) {
				throw new NodeOperationError(
					this.getNode(),
					'A2A Response Error: Missing "result" field in successful response.',
					{ itemIndex, responseData: response },
				);
			}

			return response.result as JsonObject; // Return the actual result payload (often the Task object)
		} catch (error) {
			// Catch errors from httpRequest or thrown JSON-RPC errors
			if (error instanceof NodeOperationError) {
				throw error; // Re-throw if already formatted
			}
			// Attempt to enrich HTTP errors
			let message = error.message;
			if (error.response?.data) {
				message += ` - Response: ${JSON.stringify(error.response.data)}`;
			} else if (error.statusCode) {
				message += ` - Status Code: ${error.statusCode}`;
			}

			throw new NodeOperationError(this.getNode(), message, { itemIndex });
		}
	}

	/**
	 * Parses the final Task object's artifacts into output JSON/binary data.
	 */
	private async prepareOutputData(taskResult: JsonObject, itemIndex: number): Promise<any> {
		const outputJson: JsonObject = { ...taskResult }; // Start with the full task result
		const binaryData: Record<string, Buffer> = {};
		const artifacts = taskResult.artifacts as any[]; // Type needed

		if (Array.isArray(artifacts)) {
			outputJson.parsedArtifacts = []; // Add a specific field for easier access to parsed data

			for (let i = 0; i < artifacts.length; i++) {
				const artifact = artifacts[i];
				const parsedParts: Record<string, any> = {}; // Store parsed parts for this artifact

				if (Array.isArray(artifact.parts)) {
					for (let j = 0; j < artifact.parts.length; j++) {
						const part = artifact.parts[j];
						const partKey = `part_${j}`; // Generic key

						if (part.type === 'text') {
							parsedParts[`${partKey}_text`] = part.text;
						} else if (part.type === 'data') {
							parsedParts[`${partKey}_data`] = part.data; // Already JSON
						} else if (part.type === 'file' && part.file) {
							if (part.file.bytes) {
								// Handle inline base64 binary data
								const buffer = Buffer.from(part.file.bytes, 'base64');
								const binaryKey = `artifact_${i}_part_${j}_${part.file.mimeType?.replace('/', '_') || 'file'}`;
								binaryData[binaryKey] = buffer;
								parsedParts[`${partKey}_binaryProperty`] = binaryKey; // Reference the binary data key
								parsedParts[`${partKey}_mimeType`] = part.file.mimeType;
							} else if (part.file.uri) {
								parsedParts[`${partKey}_uri`] = part.file.uri; // Pass URI through
								parsedParts[`${partKey}_mimeType`] = part.file.mimeType;
								// Optionally: Add a feature to automatically download URI content? (More complex)
							}
						}
					}
				}
				(outputJson.parsedArtifacts as any[]).push({
					name: artifact.name,
					description: artifact.description,
					...parsedParts,
				});
			}
		}

		// Return structure with JSON and potentially binary data
		if (Object.keys(binaryData).length > 0) {
			return {
				json: outputJson,
				binary: binaryData,
				pairedItem: itemIndex,
			};
		} else {
			return {
				json: outputJson,
				pairedItem: itemIndex,
			};
		}
	}
}
