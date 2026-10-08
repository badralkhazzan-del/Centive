/** Inline script that runs during HTML parsing (before first paint) on hard loads. */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Poster mode (?poster=1) and language preference are applied before paint.
export const BOOT_SCRIPT = `(function(){try{var d=document.documentElement;var q=new URLSearchParams(location.search);if(q.get('poster')==='1'){d.setAttribute('data-poster','1')}var raw=localStorage.getItem('piringtani-demo');if(raw){var s=JSON.parse(raw);var l=s&&s.state&&s.state.data&&s.state.data.ui&&s.state.data.ui.lang;if(l==='id'){d.lang='id';d.setAttribute('data-hydrating','1');setTimeout(function(){d.removeAttribute('data-hydrating')},2500)}}}catch(e){}})();`;
