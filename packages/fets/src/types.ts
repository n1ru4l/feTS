import type { Pipe, Strings, Tuples } from 'hotscript';
import type {
  FromSchema as FromSchemaOriginal,
  JSONSchema as JSONSchemaOrBoolean,
} from 'json-schema-to-ts';
import type {
  ServerAdapter,
  ServerAdapterOptions,
  ServerAdapterPlugin,
  ServerAdapterRequestHandler,
} from '@whatwg-node/server';
import type { SwaggerUIOpts } from './plugins/openapi.js';
import type { LazySerializedResponse } from './Response.js';
import type {
  HTTPMethod,
  StatusCode,
  TypedRequest,
  TypedResponse,
  TypedResponseWithJSONStatusMap,
} from './typed-fetch.js';
import type {
  AddRouteWithZodSchemasOpts,
  RouteZodSchemas,
  TypedRequestFromRouteZodSchemas,
  TypedResponseFromRouteZodSchemas,
} from './zod/types.js';

export { TypedRequest as RouterRequest };

export type Simplify<T> = { [KeyType in keyof T]: Simplify<T[KeyType]> } & {};

export type JSONSerializer = (obj: any) => string;

export type JSONSchema = Exclude<JSONSchemaOrBoolean, boolean>;

export interface OpenAPIInfo {
  title?: string;
  description?: string;
  version?: string;
  license?: {
    name?: string;
    url?: string;
  };
}

export type OpenAPIPathObject = Record<string, OpenAPIOperationObject> & {
  parameters?: OpenAPIParameterObject[];
};

export interface OpenAPIParameterObject {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  schema?: any;
}

export interface OpenAPIRequestBodyObject {
  content?: Record<string, OpenAPIMediaTypeObject>;
}

export interface OpenAPIOperationObject {
  operationId?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenAPIParameterObject[];
  requestBody?: OpenAPIRequestBodyObject;
  responses?: Record<string | number, OpenAPIResponseObject>;
}

export interface OpenAPIResponseObject {
  description?: string;
  content?: Record<string, OpenAPIMediaTypeObject>;
}

export interface OpenAPIMediaTypeObject {
  schema?: any;
}

export type OpenAPIDocument = {
  openapi?: string;
  info?: OpenAPIInfo;
  servers?:
    | {
        url: string;
      }[]
    | string[];
  paths?: Record<string, OpenAPIPathObject>;
  components?: unknown;
};

export interface RouterOpenAPIOptions<TComponents extends RouterComponentsBase>
  extends OpenAPIDocument {
  endpoint?: string | false;
  components?: TComponents;
}

export interface RouterSwaggerUIOptions extends SwaggerUIOpts {
  endpoint?: string | false;
}

export interface RouterOptions<TServerContext, TComponents extends RouterComponentsBase>
  extends ServerAdapterOptions<TServerContext> {
  base?: string;
  plugins?: RouterPlugin<TServerContext>[];

  openAPI?: RouterOpenAPIOptions<TComponents>;
  swaggerUI?: RouterSwaggerUIOptions;
}

export type RouterComponentsBase = {
  schemas?: Record<string, JSONSchema>;
};
/*
Maybe later;

type IntRange<
  START extends number,
  END extends number,
  ARR extends unknown[] = [],
  ACC extends number = never
> = ARR['length'] extends END
  ? ACC | START | END
  : IntRange<START, END, [...ARR, 1], ARR[START] extends undefined ? ACC : ACC | ARR['length']>

type RangedJSONSchema<T extends { minimum: number; maximum: number }> = T extends {
  minimum: infer MIN;
  maximum: infer MAX;
} ? MIN extends number ? MAX extends number ? IntRange<MIN, MAX> : never : never : never;
*/

export type FromSchema<T> =
  /* T extends { type: 'integer'; minimum: number; maximum: number } ? RangedJSONSchema<T> : */ T extends JSONSchema
    ? FromSchemaOriginal<
        T,
        {
          deserialize: T extends T['properties'][keyof T['properties']]
            ? false
            : [
                {
                  pattern: {
                    type: 'string';
                    format: 'binary';
                  };
                  output: File;
                },
                {
                  pattern: {
                    type: 'number';
                    format: 'int64';
                  };
                  output: bigint | number;
                },
                {
                  pattern: {
                    type: 'integer';
                    format: 'int64';
                  };
                  output: bigint | number;
                },
              ];
        }
      >
    : never;

export type FromRouterComponentSchema<
  TRouter extends Router<any, any, any>,
  TName extends string,
> = TRouter extends Router<any, infer TComponents, any>
  ? TComponents extends Required<RouterComponentsBase>
    ? FromSchema<TComponents['schemas'][TName]>
    : never
  : never;

export type PromiseOrValue<T> = T | Promise<T>;

export type StatusCodeMap<T> = {
  [TKey in StatusCode]?: T;
};

export type TypedRouterHandlerTypeConfig<
  TPath extends string,
  TRequestJSON = any,
  TRequestFormData extends Record<string, FormDataEntryValue> = Record<string, FormDataEntryValue>,
  TRequestHeaders extends Record<string, string> = Record<string, string>,
  TRequestQueryParams extends Record<string, string | string[]> = Record<string, string | string[]>,
  TRequestPathParams extends Record<string, any> = Record<
    ExtractPathParamsWithPattern<TPath>,
    string
  >,
  TResponseJSONStatusMap extends StatusCodeMap<any> = StatusCodeMap<any>,
> = {
  request: {
    json?: TRequestJSON;
    formData?: TRequestFormData;
    headers?: TRequestHeaders;
    query?: TRequestQueryParams;
    params?: TRequestPathParams;
  };
  responses?: TResponseJSONStatusMap;
};

export type TypedRequestFromTypeConfig<
  TMethod extends HTTPMethod,
  TPath extends string,
  TTypeConfig extends TypedRouterHandlerTypeConfig<TPath>,
> = TTypeConfig extends { request: Required<TypedRouterHandlerTypeConfig<TPath>>['request'] }
  ? TTypeConfig extends TypedRouterHandlerTypeConfig<
      TPath,
      infer TRequestJSON,
      infer TRequestFormData,
      infer TRequestHeaders,
      infer TRequestQueryParams,
      infer TRequestPathParams
    >
    ? TypedRequest<
        TRequestJSON,
        TRequestFormData,
        TRequestHeaders,
        TMethod,
        TRequestQueryParams,
        TRequestPathParams
      >
    : never
  : TypedRequest<
      any,
      Record<string, FormDataEntryValue>,
      Record<string, string>,
      TMethod,
      Record<string, string | string[]>,
      Record<ExtractPathParamsWithPattern<TPath>, string>
    >;

export type TypedResponseFromTypeConfig<TTypeConfig extends TypedRouterHandlerTypeConfig<string>> =
  TTypeConfig extends {
    responses: infer TResponses;
  }
    ? TResponses extends StatusCodeMap<any>
      ? TypedResponseWithJSONStatusMap<TResponses>
      : never
    : TypedResponse;

export interface RouterBaseObject<
  TServerContext,
  TComponents extends RouterComponentsBase,
  TRouterSDK extends RouterSDK<string, TypedRequest, TypedResponse>,
> {
  openAPIDocument: OpenAPIDocument;
  handle: ServerAdapterRequestHandler<TServerContext>;
  route<
    TRouteSchemas extends RouteSchemas,
    TMethod extends HTTPMethod,
    TPath extends string,
    TTypedRequest extends TypedRequestFromRouteSchemas<TComponents, TRouteSchemas, TMethod, TPath>,
    TTypedResponse extends TypedResponseFromRouteSchemas<TComponents, TRouteSchemas>,
  >(
    opts: AddRouteWithSchemasOpts<
      TServerContext,
      TComponents,
      TRouteSchemas,
      TMethod,
      TPath,
      TTypedRequest,
      TTypedResponse
    >,
  ): Router<
    TServerContext,
    TComponents,
    TRouterSDK & RouterSDK<TPath, TTypedRequest, TTypedResponse>
  >;
  route<
    TRouteZodSchemas extends RouteZodSchemas,
    TMethod extends HTTPMethod,
    TPath extends string,
    TTypedRequest extends TypedRequestFromRouteZodSchemas<TRouteZodSchemas, TMethod>,
    TTypedResponse extends TypedResponseFromRouteZodSchemas<TRouteZodSchemas>,
  >(
    opts: AddRouteWithZodSchemasOpts<
      TServerContext,
      TRouteZodSchemas,
      TMethod,
      TPath,
      TTypedRequest,
      TTypedResponse
    >,
  ): Router<
    TServerContext,
    TComponents,
    TRouterSDK & RouterSDK<TPath, TTypedRequest, TTypedResponse>
  >;
  route<
    TTypeConfig extends TypedRouterHandlerTypeConfig<TPath>,
    TMethod extends HTTPMethod,
    TPath extends string,
    TTypedRequest extends TypedRequestFromTypeConfig<
      TMethod,
      TPath,
      TTypeConfig
    > = TypedRequestFromTypeConfig<TMethod, TPath, TTypeConfig>,
    TTypedResponse extends
      TypedResponseFromTypeConfig<TTypeConfig> = TypedResponseFromTypeConfig<TTypeConfig>,
  >(
    opts: AddRouteWithTypesOpts<TServerContext, TMethod, TPath, TTypedRequest, TTypedResponse>,
  ): Router<
    TServerContext,
    TComponents,
    TRouterSDK & RouterSDK<TPath, TTypedRequest, TTypedResponse>
  >;
  __client: TRouterSDK;
  __onRouterInitHooks: OnRouterInitHook<TServerContext>[];
}

export type Router<
  TServerContext,
  TComponents extends RouterComponentsBase,
  TRouterSDK extends RouterSDK<string, TypedRequest, TypedResponse>,
> = ServerAdapter<TServerContext, RouterBaseObject<TServerContext, TComponents, TRouterSDK>>;

export type OnRouteHook<TServerContext> = (payload: OnRouteHookPayload<TServerContext>) => void;

export type RouteHandler<
  TServerContext = {},
  TTypedRequest extends TypedRequest = TypedRequest,
  TTypedResponse extends TypedResponse = TypedResponse,
> = (
  /**
   * The request object represents the incoming HTTP request.
   * This object implements [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) interface.
   */
  request: TTypedRequest,
  context: TServerContext,
) => PromiseOrValue<TTypedResponse | void>;
// TODO: Remove Response from here

export type OnRouteHookPayload<TServerContext> = {
  operationId?: string;
  description?: string;
  tags?: string[];
  method: HTTPMethod;
  path: string;
  schemas?: RouteSchemas | RouteZodSchemas;
  openAPIDocument: OpenAPIDocument;
  handlers: RouteHandler<TServerContext, TypedRequest, TypedResponse>[];
};

export type OnRouterInitHook<TServerContext> = (router: Router<TServerContext, any, any>) => void;

export type OnSerializeResponsePayload<TServerContext> = {
  request: TypedRequest;
  path: string;
  serverContext: TServerContext;
  lazyResponse: LazySerializedResponse;
};

export type OnSerializeResponseHook<TServerContext> = (
  payload: OnSerializeResponsePayload<TServerContext>,
) => void;

export type RouterPlugin<TServerContext> = ServerAdapterPlugin<TServerContext> & {
  onRouterInit?: OnRouterInitHook<TServerContext>;
  onRoute?: OnRouteHook<TServerContext>;
  onSerializeResponse?: OnSerializeResponseHook<TServerContext>;
};

export type RouteSchemas = {
  request?: {
    headers?: JSONSchema;
    params?: JSONSchema;
    query?: JSONSchema;
    json?: JSONSchema;
    formData?: JSONSchema;
  };
  responses?: StatusCodeMap<JSONSchema>;
};

export type RouterSDKOpts<
  TTypedRequest extends TypedRequest = TypedRequest,
  TMethod extends HTTPMethod = HTTPMethod,
> = TTypedRequest extends TypedRequest<
  infer TJSONBody,
  infer TFormData,
  infer THeaders,
  TMethod,
  infer TQueryParams,
  infer TPathParam
>
  ? {
      json?: TJSONBody;
      formData?: TFormData;
      headers?: THeaders;
      query?: TQueryParams;
      params?: TPathParam;
    }
  : never;

export type RouterSDK<
  TPath extends string = string,
  TTypedRequest extends TypedRequest = TypedRequest,
  TTypedResponse extends TypedResponse = TypedResponse,
> = {
  [TPathKey in TPath]: {
    [TMethod in Lowercase<TTypedRequest['method']>]: (
      opts?: RouterSDKOpts<TTypedRequest, TTypedRequest['method']>,
    ) => Promise<Exclude<TTypedResponse, undefined>>;
  };
};

export type FromSchemaWithComponents<
  TComponents,
  TSchema extends JSONSchema,
> = TComponents extends {
  schemas: Record<string, JSONSchema>;
}
  ? FromSchema<
      {
        components: TComponents;
      } & TSchema
    >
  : FromSchema<TSchema>;

export type TypedRequestFromRouteSchemas<
  TComponents extends RouterComponentsBase,
  TRouteSchemas extends RouteSchemas,
  TMethod extends HTTPMethod,
  TPath extends string,
> = TRouteSchemas extends { request: Required<RouteSchemas>['request'] }
  ? TypedRequest<
      TRouteSchemas['request'] extends { json: JSONSchema }
        ? FromSchemaWithComponents<TComponents, TRouteSchemas['request']['json']>
        : any,
      TRouteSchemas['request'] extends { formData: JSONSchema }
        ? FromSchemaWithComponents<
            TComponents,
            TRouteSchemas['request']['formData']
          > extends Record<string, FormDataEntryValue>
          ? FromSchemaWithComponents<TComponents, TRouteSchemas['request']['formData']>
          : Record<string, FormDataEntryValue>
        : Record<string, FormDataEntryValue>,
      TRouteSchemas['request'] extends { headers: JSONSchema }
        ? FromSchemaWithComponents<TComponents, TRouteSchemas['request']['headers']> extends Record<
            string,
            string
          >
          ? FromSchemaWithComponents<TComponents, TRouteSchemas['request']['headers']>
          : Record<string, string>
        : Record<string, string>,
      TMethod,
      TRouteSchemas['request'] extends { query: JSONSchema }
        ? FromSchemaWithComponents<TComponents, TRouteSchemas['request']['query']> extends Record<
            string,
            string | string[]
          >
          ? FromSchemaWithComponents<TComponents, TRouteSchemas['request']['query']>
          : Record<string, string | string[]>
        : Record<string, string | string[]>,
      TRouteSchemas['request'] extends { params: JSONSchema }
        ? FromSchemaWithComponents<TComponents, TRouteSchemas['request']['params']> extends Record<
            string,
            any
          >
          ? FromSchemaWithComponents<TComponents, TRouteSchemas['request']['params']>
          : Record<ExtractPathParamsWithPattern<TPath>, string>
        : Record<ExtractPathParamsWithPattern<TPath>, string>
    >
  : TypedRequest<
      any,
      Record<string, FormDataEntryValue>,
      Record<string, string>,
      TMethod,
      Record<string, string | string[]>,
      Record<ExtractPathParamsWithPattern<TPath>, string>
    >;

export type TypedResponseFromRouteSchemas<
  TComponents extends RouterComponentsBase,
  TRouteSchemas extends RouteSchemas,
> = TRouteSchemas extends { responses: StatusCodeMap<JSONSchema> }
  ? TypedResponseWithJSONStatusMap<{
      [TStatusCode in keyof TRouteSchemas['responses']]: TRouteSchemas['responses'][TStatusCode] extends JSONSchema
        ? FromSchemaWithComponents<TComponents, TRouteSchemas['responses'][TStatusCode]>
        : never;
    }>
  : TypedResponse;

export type AddRouteWithSchemasOpts<
  TServerContext,
  TComponents extends RouterComponentsBase,
  TRouteSchemas extends RouteSchemas,
  TMethod extends HTTPMethod,
  TPath extends string,
  TTypedRequest extends TypedRequestFromRouteSchemas<TComponents, TRouteSchemas, TMethod, TPath>,
  TTypedResponse extends TypedResponseFromRouteSchemas<TComponents, TRouteSchemas>,
> = {
  schemas: TRouteSchemas;
} & AddRouteWithTypesOpts<TServerContext, TMethod, TPath, TTypedRequest, TTypedResponse>;

export type AddRouteWithTypesOpts<
  TServerContext,
  TMethod extends HTTPMethod,
  TPath extends string,
  TTypedRequest extends TypedRequest<
    any,
    Record<string, FormDataEntryValue>,
    Record<string, string>,
    TMethod,
    Record<string, string | string[]>,
    Record<ExtractPathParamsWithPattern<TPath>, string>
  >,
  TTypedResponse extends TypedResponse,
> = {
  operationId?: string;
  description?: string;
  method?: TMethod;
  tags?: string[];
  internal?: boolean;
  path: TPath;
  handler:
    | RouteHandler<TServerContext, TTypedRequest, TTypedResponse>
    | RouteHandler<TServerContext, TTypedRequest, TTypedResponse>[];
};

export type RouteInput<
  TRouter extends Router<any, any, {}>,
  TPath extends string,
  TMethod extends Lowercase<HTTPMethod> = 'post',
  TParamType extends keyof RouterSDKOpts = 'json',
> = TRouter extends Router<any, any, infer TRouterSDK>
  ? TRouterSDK[TPath][TMethod] extends (requestParams?: infer TRequestParams) => any
    ? TRequestParams extends {
        [TParamTypeKey in TParamType]?: infer TParamTypeValue;
      }
      ? TParamTypeValue
      : never
    : never
  : never;

export type RouteOutput<
  TRouter extends Router<any, any, {}>,
  TPath extends string,
  TMethod extends Lowercase<HTTPMethod> = 'post',
  TStatusCode extends StatusCode = 200,
> = TRouter extends Router<any, any, infer TRouterSDK>
  ? TRouterSDK extends RouterSDK
    ? TRouterSDK[TPath][TMethod] extends (...args: any[]) => Promise<infer TTypedResponse>
      ? TTypedResponse extends TypedResponse<infer TJSONBody, any, TStatusCode>
        ? TJSONBody
        : never
      : never
    : never
  : never;

export type RouterClient<TRouter extends Router<any, any, any>> = TRouter['__client'];

export type RouterInput<TRouter extends Router<any, any, any>> = {
  [TPath in keyof RouterClient<TRouter>]: {
    [TMethod in keyof RouterClient<TRouter>[TPath]]: RouterClient<TRouter>[TPath][TMethod] extends (
      requestParams?: infer TRequestParams,
    ) => any
      ? Required<TRequestParams>
      : never;
  };
};

export type RouterJsonPostInput<TRouter extends Router<any, any, any>> = {
  [TPath in keyof RouterClient<TRouter>]: {
    [TMethod in keyof RouterClient<TRouter>[TPath]]: RouterInput<TRouter>[TPath][TMethod] extends {
      json: infer TJSON;
    }
      ? TJSON
      : never;
  }['post'];
};

export type RouterJsonPostSuccessOutput<TRouter extends Router<any, any, any>> = {
  [TPath in keyof RouterClient<TRouter>]: {
    [TMethod in keyof RouterClient<TRouter>[TPath]]: RouterOutput<TRouter>[TPath][TMethod][200];
  }['post'];
};

export type RouterOutput<TRouter extends Router<any, any, any>> = {
  [TPath in keyof RouterClient<TRouter>]: {
    [TMethod in keyof RouterClient<TRouter>[TPath]]: RouterClient<TRouter>[TPath][TMethod] extends (
      requestParams?: any,
    ) => Promise<infer TTypedResponse>
      ? {
          [TStatusCode in StatusCode]: TTypedResponse extends TypedResponse<
            infer TJSONBody,
            any,
            TStatusCode
          >
            ? TJSONBody
            : never;
        }
      : never;
  };
};

export type RouterComponentSchema<
  TRouter extends Router<any, any, any>,
  TName extends string,
> = TRouter extends Router<any, infer TComponents, any>
  ? TComponents extends { schemas: Record<string, JSONSchema> }
    ? FromSchema<TComponents['schemas'][TName]>
    : never
  : never;

export type ExtractPathParamsWithBrackets<TPath extends string> = Pipe<
  TPath,
  [
    Strings.Split<'/' | ';'>,
    Tuples.Filter<Strings.StartsWith<'{'>>,
    Tuples.Map<Strings.Trim<'{' | '}'>>,
    Tuples.ToUnion,
  ]
>;

export type ExtractPathParamsWithPattern<TPath extends string> = Pipe<
  TPath,
  [
    Strings.Split<'/'>,
    Tuples.Filter<Strings.StartsWith<':'>>,
    Tuples.Map<Strings.Trim<':'>>,
    Tuples.ToUnion,
  ]
>;
