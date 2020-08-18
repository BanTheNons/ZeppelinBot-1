import { Case } from "../../../data/entities/Case";
import { AdvancedMessageContent, MessageContent } from "eris";
import moment from "moment-timezone";
import { CaseTypes } from "../../../data/CaseTypes";
import { PluginData, helpers } from "knub";
import { CasesPluginType } from "../types";
import { resolveCaseId } from "./resolveCaseId";
import { chunkLines, chunkMessageLines, emptyEmbedValue, messageLink } from "../../../utils";
import { getCaseColor } from "./getCaseColor";
import { TimeAndDatePlugin } from "../../TimeAndDate/TimeAndDatePlugin";

export async function getCaseEmbed(
  pluginData: PluginData<CasesPluginType>,
  caseOrCaseId: Case | number,
  requestMemberId?: string,
): Promise<AdvancedMessageContent> {
  const theCase = await pluginData.state.cases.with("notes").find(resolveCaseId(caseOrCaseId));
  if (!theCase) return null;

  const timeAndDate = pluginData.getPlugin(TimeAndDatePlugin);

  const createdAt = moment.utc(theCase.created_at);
  const actionTypeStr = CaseTypes[theCase.type].toUpperCase();

  let userName = theCase.user_name;
  if (theCase.user_id && theCase.user_id !== "0") userName += `\n<@!${theCase.user_id}>`;

  let modName = theCase.mod_name;
  if (theCase.mod_id) modName += `\n<@!${theCase.mod_id}>`;

  const createdAtWithTz = requestMemberId
    ? await timeAndDate.inMemberTz(requestMemberId, createdAt)
    : timeAndDate.inGuildTz(createdAt);

  const embed: any = {
    title: `${actionTypeStr} - Case #${theCase.case_number}`,
    footer: {
      text: `Case created on ${createdAtWithTz.format(timeAndDate.getDateFormat("pretty_datetime"))}`,
    },
    fields: [
      {
        name: "User",
        value: userName,
        inline: true,
      },
      {
        name: "Moderator",
        value: modName,
        inline: true,
      },
    ],
  };

  if (theCase.pp_id) {
    embed.fields[1].value += `\np.p. ${theCase.pp_name}\n<@!${theCase.pp_id}>`;
  }

  if (theCase.is_hidden) {
    embed.title += " (hidden)";
  }

  embed.color = getCaseColor(pluginData, theCase.type);

  if (theCase.notes.length) {
    for (const note of theCase.notes) {
      const noteDate = moment.utc(note.created_at);
      let noteBody = note.body.trim();
      if (noteBody === "") {
        noteBody = emptyEmbedValue;
      }

      const chunks = chunkMessageLines(noteBody, 1014);

      for (let i = 0; i < chunks.length; i++) {
        if (i === 0) {
          const noteDateWithTz = requestMemberId
            ? await timeAndDate.inMemberTz(requestMemberId, noteDate)
            : timeAndDate.inGuildTz(noteDate);
          const prettyNoteDate = noteDateWithTz.format(timeAndDate.getDateFormat("pretty_datetime"));
          embed.fields.push({
            name: `${note.mod_name} at ${prettyNoteDate}:`,
            value: chunks[i],
          });
        } else {
          embed.fields.push({
            name: emptyEmbedValue,
            value: chunks[i],
          });
        }
      }
    }
  } else {
    embed.fields.push({
      name: "!!! THIS CASE HAS NO NOTES !!!",
      value: "\u200B",
    });
  }

  if (theCase.log_message_id) {
    const [channelId, messageId] = theCase.log_message_id.split("-");
    const link = messageLink(pluginData.guild.id, channelId, messageId);
    embed.fields.push({
      name: emptyEmbedValue,
      value: `[Go to original case in case log channel](${link})`,
    });
  }

  return { embed };
}
