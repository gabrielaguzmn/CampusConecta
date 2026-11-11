
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { executeIntent, type NavigationAdapter } from "../actionRegistry";
import type { Intent, Page, SpeechState } from "../assistantTypes";
import { ASSISTANT_RESPONSES } from "../catalogs/responses";
import { interpretConfirmation } from "../confirmation";
import { interpretAsync } from "../semantic/hybridInterpreter";
import type { SpeechProvider } from "../speech/SpeechProvider";
import { WebSpeechProvider } from "../speech/webSpeechProvider";
import { AssistantFeedback } from "./AssistantFeedback";
import { VoiceButton } from "./VoiceButton";

function pageFromPath(pathname: string): Page {
  if (pathname.startsWith("/mapa")) return "MAP";
  if (pathname.startsWith("/mis-eventos/nuevo")) return "CREATE_EVENT";
  if (pathname.startsWith("/mis-eventos")) return "MY_EVENTS";
  return "FEED";
}

const PATHS: Record<Page, string> = {
  MAP: "/mapa",
  FEED: "/feed",
  MY_EVENTS: "/mis-eventos",
  CREATE_EVENT: "/mis-eventos/nuevo",
};

const INTENT_LABELS = {
  OPEN_MAP: "abrir el mapa",
  OPEN_FEED: "ver el Feed",
  OPEN_MY_EVENTS: "ver mis eventos",
  CREATE_EVENT: "crear un evento",
} as const;

const CONFIRMATION_TIMEOUT_MS = 10_000;

export function VoiceAssistant({
  createProvider = () => new WebSpeechProvider(),
}: {
  createProvider?: () => SpeechProvider;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const locationRef = useRef(location.pathname);
  const providerRef = useRef<SpeechProvider | null>(null);

  const pendingIntentRef = useRef<Exclude<Intent, "UNKNOWN"> | null>(null);
  const confirmationTimerRef = useRef<number | null>(null);
  const confirmationActiveRef = useRef(false);

  const [state, setState] = useState<SpeechState>("idle");
  const [interim, setInterim] = useState("");
  const [final, setFinal] = useState("");
  const [response, setResponse] = useState("");
  const [isWaitingConfirmation, setIsWaitingConfirmation] =
    useState(false);

  // Mantener actualizada la ruta actual.
  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  // Limpiar el temporizador de confirmación.
  function clearConfirmationTimer() {
    if (confirmationTimerRef.current !== null) {
      window.clearTimeout(confirmationTimerRef.current);
      confirmationTimerRef.current = null;
    }
  }

  // Cancelar completamente una confirmación pendiente.
  function cancelConfirmation() {
    confirmationActiveRef.current = false;
    pendingIntentRef.current = null;

    clearConfirmationTimer();

    providerRef.current?.stop();

    setIsWaitingConfirmation(false);
    setInterim("");
    setFinal("");
    setResponse("");
    setState("idle");
  }

  async function runCommand(text: string) {
    const navigation: NavigationAdapter = {
      getCurrentPage: () => pageFromPath(locationRef.current),
      goTo: (page) => navigate(PATHS[page]),
    };

    const pendingIntent = pendingIntentRef.current;

    // CASO 1: respuesta a una sugerencia pendiente.
    if (pendingIntent) {
      confirmationActiveRef.current = false;
      pendingIntentRef.current = null;

      clearConfirmationTimer();

      providerRef.current?.stop();

      setIsWaitingConfirmation(false);
      setFinal(text);
      setInterim("");

      const confirmation = interpretConfirmation(text);

      if (confirmation === "accept") {
        setResponse(executeIntent(pendingIntent, navigation).response);
      } else if (confirmation === "reject") {
        setResponse("Acción cancelada.");
      } else {
        setResponse(
          "No pude interpretar tu respuesta. La acción no se ejecutó.",
        );
      }

      setState("idle");
      return;
    }

    // CASO 2: interpretar un comando normal.
    const result = await interpretAsync(text, {
      currentPage: navigation.getCurrentPage(),
    });

    const action = result.suggestion
      ? {
          response: `¿Quisiste decir "${
            result.suggestion.intent
              ? INTENT_LABELS[result.suggestion.intent]
              : "esa acción"
          }"?`,
        }
      : executeIntent(result.intent, navigation);

    setFinal(text);
    setInterim("");

    pendingIntentRef.current = result.suggestion?.intent ?? null;

    const semanticScore = result.suggestion?.score ?? result.confidence;

    const debugInfo =
      import.meta.env.DEV &&
      result.source === "semantic" &&
      semanticScore > 0
        ? ` (similitud ${semanticScore.toFixed(2)})`
        : "";

    setResponse(`${action.response}${debugInfo}`);

    // CASO 3: se encontró una sugerencia.
    if (result.suggestion?.intent) {
      confirmationActiveRef.current = true;

      setIsWaitingConfirmation(true);
      setResponse(`${action.response}${debugInfo}`);

      // Activar automáticamente el micrófono.
      setState("listening");

      try {
        providerRef.current?.start();
      } catch {
        cancelConfirmation();
        setResponse(ASSISTANT_RESPONSES.speechStartError);
        setState("error");
        return;
      }

      // Esperar máximo 10 segundos.
      confirmationTimerRef.current = window.setTimeout(() => {
        if (!confirmationActiveRef.current) return;

        confirmationActiveRef.current = false;
        pendingIntentRef.current = null;
        confirmationTimerRef.current = null;

        providerRef.current?.stop();

        setIsWaitingConfirmation(false);
        setFinal("");
        setInterim("");
        setResponse("");
        setState("idle");
      }, CONFIRMATION_TIMEOUT_MS);

      return;
    }

    // CASO 4: comando normal terminado.
    setState("idle");
  }

  // Inicialización del proveedor de reconocimiento de voz.
  useEffect(() => {
    const provider = createProvider();
    providerRef.current = provider;

    provider.onInterimResult((text) => {
      setInterim(text);
    });

    provider.onFinalResult((text) => {
      // Ignorar resultados de una confirmación que ya terminó.
      if (
        pendingIntentRef.current &&
        !confirmationActiveRef.current
      ) {
        return;
      }

      // Ignorar resultados vacíos.
      if (!text.trim()) return;

      // Detener el reconocimiento antes de procesar.
      provider.stop();

      setState("processing");
      void runCommand(text);
    });

    provider.onError((error) => {
      confirmationActiveRef.current = false;
      pendingIntentRef.current = null;

      clearConfirmationTimer();

      provider.stop();

      setIsWaitingConfirmation(false);
      setResponse(ASSISTANT_RESPONSES.speechError(error));
      setState("error");
    });

    return () => {
      confirmationActiveRef.current = false;
      pendingIntentRef.current = null;

      clearConfirmationTimer();

      provider.stop();
      providerRef.current = null;
    };

    // El factory debe permanecer estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Control manual del micrófono.
  function toggleListening() {
    // Si estamos esperando una confirmación,
    // pulsar el botón cancela la sugerencia.
    if (isWaitingConfirmation) {
      cancelConfirmation();
      return;
    }

    // Detener una escucha normal.
    if (state === "listening") {
      providerRef.current?.stop();
      setState("processing");
      return;
    }

    // Iniciar una nueva escucha.
    setInterim("");
    setFinal("");
    setResponse("");

    setState("listening");
    providerRef.current?.start();
  }

  return (
    <section
      className="fixed bottom-4 right-4 z-50 flex max-w-[min(24rem,calc(100vw-2rem))] flex-col items-end gap-2"
      aria-label="Asistente de voz"
    >
      {(interim || final || response || isWaitingConfirmation) && (
        <div className="w-full rounded-tarjeta border border-borde bg-superficie p-3 text-sm shadow-elevada">
          {interim && (
            <p>
              <span className="font-semibold">Escuchando:</span>{" "}
              {interim}
            </p>
          )}

          {final && (
            <p>
              <span className="font-semibold">Entendido:</span>{" "}
              {final}
            </p>
          )}

          {response && (
            <p className="mt-1 text-texto-secundario">
              {response}
            </p>
          )}

          {isWaitingConfirmation && (
            <p
              className="mt-2 flex items-center gap-2 font-semibold text-primario"
              role="status"
              aria-live="polite"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
              Esperando respuesta...
            </p>
          )}
        </div>
      )}

      {/* Entrada manual para pruebas en desarrollo. */}
      {import.meta.env.DEV && (
        <form
          className="flex w-full gap-2 rounded-tarjeta border border-borde bg-superficie p-2 shadow-elevada"
          onSubmit={(event) => {
            event.preventDefault();

            const form = new FormData(event.currentTarget);
            const command = String(
              form.get("voice-command") ?? "",
            ).trim();

            if (command) {
              providerRef.current?.stop();
              void runCommand(command);
            }

            event.currentTarget.reset();
          }}
        >
          <label className="sr-only" htmlFor="voice-command">
            Comando de voz de prueba
          </label>

          <input
            id="voice-command"
            name="voice-command"
            className="min-w-0 flex-1 rounded-control border border-borde px-2 py-1"
            placeholder="Probar comando"
          />

          <button
            type="submit"
            className="rounded-control bg-primario px-2 py-1 text-sm font-semibold text-white"
          >
            Enviar
          </button>
        </form>
      )}

      <VoiceButton
        state={state}
        onClick={toggleListening}
      />

      <AssistantFeedback
        state={state}
        interim={interim}
        final={final}
        response={response}
      />
    </section>
  );
}
