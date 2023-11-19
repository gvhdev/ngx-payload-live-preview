# ngx-payload-live-preview

The ngx-payload-live-preview library is tailored for seamless integration within Angular applications, aiming to replicate the functionality offered by the @payloadcms/live-preview package while aligning closely with Angular development paradigms.

-   This library adopts Observables as a preferred mechanism over the traditional `subscribe`/`unsubscribe` methods found in the original package, ensuring a more reactive and efficient approach to data handling.
-   Leveraging Angular's `HttpModule` instead of native fetch, the library ensures compatibility with Angular interceptors.
-   Addressing a notable gap in the PayloadCMS package, `ngx-payload-live-preview` offers robust handling capabilities for Rich Text fields, enhancing content management within Angular applications.
-   The library advocates the use of providers for managing constants such as `serverURL` or `apiRoute`, streamlining the configuration process and promoting a more maintainable codebase.

As of the present phase, the library remains in an 'alpha' stage of development, primarily deployed within organizational projects.
