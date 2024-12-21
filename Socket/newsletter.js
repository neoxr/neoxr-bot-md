"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractNewsletterMetadata = exports.makeNewsLetterSocket = void 0;
const Types_1 = require("../Types");
const Utils_1 = require("../Utils");
const WABinary_1 = require("../WABinary");
const groups_1 = require("./groups");
const makeNewsLetterSocket = (config) => {
    const sock = (0, groups_1.makeGroupsSocket)(config);
    const { authState, signalRepository, query, generateMessageTag } = sock;
    const encoder = new TextEncoder();
    const newsletterQuery = async (jid, type, content) => query({
        tag: "iq",
        attrs: {
            id: generateMessageTag(),
            type,
            xmlns: "newsletter",
            to: jid,
        },
        content,
    });
    const newsletterWMexQuery = async (jid, queryId, content) => query({
        tag: "iq",
        attrs: {
            id: generateMessageTag(),
            type: "get",
            xmlns: "w:mex",
            to: WABinary_1.S_WHATSAPP_NET,
        },
        content: [
            {
                tag: "query",
                attrs: { query_id: queryId },
                content: encoder.encode(JSON.stringify({
                    variables: {
                        newsletter_id: jid,
                        ...content,
                    },
                })),
            },
        ],
    });
    const parseFetchedUpdates = async (node, type) => {
        let child;
        if (type === "messages") {
            child = (0, WABinary_1.getBinaryNodeChild)(node, "messages");
        }
        else {
            const parent = (0, WABinary_1.getBinaryNodeChild)(node, "message_updates");
            child = (0, WABinary_1.getBinaryNodeChild)(parent, "messages");
        }
        return await Promise.all((0, WABinary_1.getAllBinaryNodeChildren)(child).map(async (messageNode) => {
            var _a, _b;
            messageNode.attrs.from = child === null || child === void 0 ? void 0 : child.attrs.jid;
            const views = parseInt(((_b = (_a = (0, WABinary_1.getBinaryNodeChild)(messageNode, "views_count")) === null || _a === void 0 ? void 0 : _a.attrs) === null || _b === void 0 ? void 0 : _b.count) || "0");
            const reactionNode = (0, WABinary_1.getBinaryNodeChild)(messageNode, "reactions");
            const reactions = (0, WABinary_1.getBinaryNodeChildren)(reactionNode, "reaction").map(({ attrs }) => ({ count: +attrs.count, code: attrs.code }));
            const data = {
                server_id: messageNode.attrs.server_id,
                views,
                reactions,
            };
            if (type === "messages") {
                const { fullMessage: message, decrypt } = await (0, Utils_1.decryptMessageNode)(messageNode, authState.creds.me.id, authState.creds.me.lid || "", signalRepository, config.logger);
                await decrypt();
                data.message = message;
            }
            return data;
        }));
    };
    return {
        ...sock,
        extractNewsletterMetadata: exports.extractNewsletterMetadata,
        subscribeNewsletterUpdates: async (jid) => {
            var _a;
            const result = await newsletterQuery(jid, "set", [
                { tag: "live_updates", attrs: {}, content: [] },
            ]);
            return (_a = (0, WABinary_1.getBinaryNodeChild)(result, "live_updates")) === null || _a === void 0 ? void 0 : _a.attrs;
        },
        newsletterReactionMode: async (jid, mode) => {
            await newsletterWMexQuery(jid, Types_1.QueryIds.JOB_MUTATION, {
                updates: { settings: { reaction_codes: { value: mode } } },
            });
        },
        newsletterUpdateDescription: async (jid, description) => {
            await newsletterWMexQuery(jid, Types_1.QueryIds.JOB_MUTATION, {
                updates: { description: description || "", settings: null },
            });
        },
        newsletterUpdateName: async (jid, name) => {
            await newsletterWMexQuery(jid, Types_1.QueryIds.JOB_MUTATION, {
                updates: { name, settings: null },
            });
        },
        newsletterUpdatePicture: async (jid, content) => {
            const { img } = await (0, Utils_1.generateProfilePicture)(content);
            await newsletterWMexQuery(jid, Types_1.QueryIds.JOB_MUTATION, {
                updates: { picture: img.toString("base64"), settings: null },
            });
        },
        newsletterRemovePicture: async (jid) => {
            await newsletterWMexQuery(jid, Types_1.QueryIds.JOB_MUTATION, {
                updates: { picture: "", settings: null },
            });
        },
        newsletterAction: async (jid, type) => {
            await newsletterWMexQuery(jid, type.toUpperCase());
        },
        newsletterCreate: async (name, description) => {
            //TODO: Implement TOS system wide for Meta AI, communities, and here etc.
            /**tos query */
            await query({
                tag: "iq",
                attrs: {
                    to: WABinary_1.S_WHATSAPP_NET,
                    xmlns: "tos",
                    id: generateMessageTag(),
                    type: "set",
                },
                content: [
                    {
                        tag: "notice",
                        attrs: {
                            id: "20601218",
                            stage: "5",
                        },
                        content: [],
                    },
                ],
            });
            const result = await newsletterWMexQuery(undefined, Types_1.QueryIds.CREATE, {
                input: { name, description },
            });
            return (0, exports.extractNewsletterMetadata)(result, true);
        },
        newsletterMetadata: async (type, key, role) => {
            const result = await newsletterWMexQuery(undefined, Types_1.QueryIds.METADATA, {
                input: {
                    key,
                    type: type.toUpperCase(),
                    view_role: role || "GUEST",
                },
                fetch_viewer_metadata: true,
                fetch_full_image: true,
                fetch_creation_time: true,
            });
            return (0, exports.extractNewsletterMetadata)(result);
        },
        newsletterAdminCount: async (jid) => {
            var _a, _b;
            const result = await newsletterWMexQuery(jid, Types_1.QueryIds.ADMIN_COUNT);
            const buff = (_b = (_a = (0, WABinary_1.getBinaryNodeChild)(result, "result")) === null || _a === void 0 ? void 0 : _a.content) === null || _b === void 0 ? void 0 : _b.toString();
            return JSON.parse(buff).data[Types_1.XWAPaths.ADMIN_COUNT].admin_count;
        },
        /**user is Lid, not Jid */
        newsletterChangeOwner: async (jid, user) => {
            await newsletterWMexQuery(jid, Types_1.QueryIds.CHANGE_OWNER, {
                user_id: user,
            });
        },
        /**user is Lid, not Jid */
        newsletterDemote: async (jid, user) => {
            await newsletterWMexQuery(jid, Types_1.QueryIds.DEMOTE, {
                user_id: user,
            });
        },
        newsletterDelete: async (jid) => {
            await newsletterWMexQuery(jid, Types_1.QueryIds.DELETE);
        },
        /**if code wasn't passed, the reaction will be removed (if is reacted) */
        newsletterReactMessage: async (jid, serverId, code) => {
            await query({
                tag: "message",
                attrs: {
                    to: jid,
                    ...(!code ? { edit: "7" } : {}),
                    type: "reaction",
                    server_id: serverId,
                    id: (0, Utils_1.generateMessageID)(),
                },
                content: [
                    {
                        tag: "reaction",
                        attrs: code ? { code } : {},
                    },
                ],
            });
        },
        newsletterFetchMessages: async (type, key, count, after) => {
            const result = await newsletterQuery(WABinary_1.S_WHATSAPP_NET, "get", [
                {
                    tag: "messages",
                    attrs: {
                        type,
                        ...(type === "invite" ? { key } : { jid: key }),
                        count: count.toString(),
                        after: (after === null || after === void 0 ? void 0 : after.toString()) || "100",
                    },
                },
            ]);
            return await parseFetchedUpdates(result, "messages");
        },
        newsletterFetchUpdates: async (jid, count, after, since) => {
            const result = await newsletterQuery(jid, "get", [
                {
                    tag: "message_updates",
                    attrs: {
                        count: count.toString(),
                        after: (after === null || after === void 0 ? void 0 : after.toString()) || "100",
                        since: (since === null || since === void 0 ? void 0 : since.toString()) || "0",
                    },
                },
            ]);
            return await parseFetchedUpdates(result, "updates");
        },
        newsletterWMexQuery,
        newsletterQuery,
    };
};
exports.makeNewsLetterSocket = makeNewsLetterSocket;
const extractNewsletterMetadata = (node, isCreate) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
    const result = (_b = (_a = (0, WABinary_1.getBinaryNodeChild)(node, "result")) === null || _a === void 0 ? void 0 : _a.content) === null || _b === void 0 ? void 0 : _b.toString();
    const metadataPath = JSON.parse(result).data[isCreate ? Types_1.XWAPaths.CREATE : Types_1.XWAPaths.NEWSLETTER];
    const metadata = {
        id: metadataPath === null || metadataPath === void 0 ? void 0 : metadataPath.id,
        state: (_c = metadataPath === null || metadataPath === void 0 ? void 0 : metadataPath.state) === null || _c === void 0 ? void 0 : _c.type,
        creation_time: +((_d = metadataPath === null || metadataPath === void 0 ? void 0 : metadataPath.thread_metadata) === null || _d === void 0 ? void 0 : _d.creation_time),
        name: (_f = (_e = metadataPath === null || metadataPath === void 0 ? void 0 : metadataPath.thread_metadata) === null || _e === void 0 ? void 0 : _e.name) === null || _f === void 0 ? void 0 : _f.text,
        nameTime: +((_h = (_g = metadataPath === null || metadataPath === void 0 ? void 0 : metadataPath.thread_metadata) === null || _g === void 0 ? void 0 : _g.name) === null || _h === void 0 ? void 0 : _h.update_time),
        description: (_k = (_j = metadataPath === null || metadataPath === void 0 ? void 0 : metadataPath.thread_metadata) === null || _j === void 0 ? void 0 : _j.description) === null || _k === void 0 ? void 0 : _k.text,
        descriptionTime: +((_m = (_l = metadataPath === null || metadataPath === void 0 ? void 0 : metadataPath.thread_metadata) === null || _l === void 0 ? void 0 : _l.description) === null || _m === void 0 ? void 0 : _m.update_time),
        invite: (_o = metadataPath === null || metadataPath === void 0 ? void 0 : metadataPath.thread_metadata) === null || _o === void 0 ? void 0 : _o.invite,
        handle: (_p = metadataPath === null || metadataPath === void 0 ? void 0 : metadataPath.thread_metadata) === null || _p === void 0 ? void 0 : _p.handle,
        picture: ((_r = (_q = metadataPath === null || metadataPath === void 0 ? void 0 : metadataPath.thread_metadata) === null || _q === void 0 ? void 0 : _q.picture) === null || _r === void 0 ? void 0 : _r.direct_path) || null,
        preview: ((_t = (_s = metadataPath === null || metadataPath === void 0 ? void 0 : metadataPath.thread_metadata) === null || _s === void 0 ? void 0 : _s.preview) === null || _t === void 0 ? void 0 : _t.direct_path) || null,
        reaction_codes: (_w = (_v = (_u = metadataPath.thread_metadata) === null || _u === void 0 ? void 0 : _u.settings) === null || _v === void 0 ? void 0 : _v.reaction_codes) === null || _w === void 0 ? void 0 : _w.value,
        subscribers: +((_x = metadataPath === null || metadataPath === void 0 ? void 0 : metadataPath.thread_metadata) === null || _x === void 0 ? void 0 : _x.subscribers_count) || 0,
        verification: (_y = metadataPath === null || metadataPath === void 0 ? void 0 : metadataPath.thread_metadata) === null || _y === void 0 ? void 0 : _y.verification,
        viewer_metadata: metadataPath === null || metadataPath === void 0 ? void 0 : metadataPath.viewer_metadata,
    };
    return metadata;
};
exports.extractNewsletterMetadata = extractNewsletterMetadata;