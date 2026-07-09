import type { Event } from "@/slack/types/events";

export function registerSelfbotEvents(socket: WebSocket) {
  socket.addEventListener("message", (event) => {
    const eventData = JSON.parse(event.data) as Event;
    // if (eventData.type === "user_typing") {
    //   const typingEventData = eventData as TypingEvent;
    //   if (typingEventData.channel === "C0BEVRMGY23") {
    //     web.chat.postEphemeral({
    //       channel: typingEventData.channel,
    //       text: "HEY STOP",
    //       user: typingEventData.user,
    //       thread_ts: typingEventData.thread_ts,
    //     });
    //   }
    //   console.log(typingEventData);
    // }
    if (eventData.type === "ping") {
      socket.send(JSON.stringify({ type: "pong", reply_to: eventData.id }));
    }
  });
}
