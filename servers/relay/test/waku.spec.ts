import "mocha";
import { expect } from "chai";
import pino from "pino";
import { getDefaultLoggerOptions } from "@pedrouid/pino-utils";
import { WakuService } from "../src/waku";
import { WakuMessage, WakuPeers } from "../src/types";
import { generateRandomBytes32 } from "../src/utils";

import { TEST_WAKU_URL } from "./shared";

describe("Waku", () => {
  let wakuOne: WakuService;
  let wakuTwo: WakuService;
  let contentTopic: string;
  let testMessage: string;
  let topic: string;
  before(() => {
    let logger = pino(getDefaultLoggerOptions({ level: "error" }));
    wakuOne = new WakuService(logger, TEST_WAKU_URL);
    wakuTwo = new WakuService(logger, TEST_WAKU_URL.replace("8546", "8547"));
  });
  beforeEach(() => {
    testMessage = generateRandomBytes32();
    contentTopic = generateRandomBytes32();
    topic = generateRandomBytes32();
  });
  it("Waku node has peers", async () => {
    wakuOne.getPeers((err, peers: WakuPeers[]) => {
      expect(err).to.be.undefined;
      expect(peers.length).to.be.greaterThan(0);
    });
  });
  it("Receives a filter message on Waku A from Waku B using filter api", function(done) {
    wakuOne.filterSubscribe(contentTopic);
    setTimeout(() => {
      wakuTwo.post(testMessage, contentTopic);
    }, 100);
    setTimeout(() => {
      wakuOne.getFilterMessages(contentTopic, (err, messages: WakuMessage[]) => {
        expect(err).to.be.undefined;
        expect(messages.length).to.equal(1);
        expect(messages[0].payload).to.equal(testMessage);
        expect(messages[0].contentTopic).to.equal(contentTopic);
        done();
      });
    }, 200);
  });

  it("Receive message on Waku A from Waku B using relay api", function(done) {
    wakuOne.subscribe(topic);
    setTimeout(() => {
      wakuTwo.post(testMessage, "", topic);
    }, 100);
    setTimeout(() => {
      wakuOne.getMessages(topic, (err, m) => {
        expect(err).to.be.undefined;
        expect(m.length).to.be.greaterThan(0);
        expect(m[0].payload).to.equal(testMessage);
        done();
      });
    }, 200);
  });
  // We aren't doing global topic polling anymore
  // But polling for global topic to see if we missed a filter message
  // could be an alternative to using the store to get historical message
  // The problem with that is that there is a potential that a lot of messages
  // need to get filtered in search for the specific filter
  xit("It polls for messages", function(done) {
    wakuOne.onNewMessage(topic, (err, messages) => {
      expect(err).to.be.undefined;
      expect(messages.length).to.equal(1);
      expect(messages[0].payload).to.equal(testMessage);
      done();
    });
    setTimeout(() => {
      wakuTwo.post(testMessage, "", topic);
    }, 750);
  });
  it("It polls for filter messages", function(done) {
    wakuOne.onNewFilterMessage(contentTopic, (err, messages) => {
      expect(err).to.be.undefined;
      expect(messages.length).to.equal(1);
      expect(messages[0].payload).to.equal(testMessage);
      done();
    });
    setTimeout(() => {
      wakuTwo.post(testMessage, contentTopic);
    }, 750);
  });
  it("Filter unsubscribe works", function(done) {
    wakuOne.logger.level = "silent";
    wakuOne.onNewFilterMessage(contentTopic, () => {});
    setTimeout(() => {
      wakuOne.filterUnsubscribe(contentTopic);
    }, 100);
    setTimeout(() => {
      expect(wakuOne.filterTopics).not.include(contentTopic);
      wakuOne.getFilterMessages(contentTopic, (err, messages) => {
        expect(err).to.exist;
        expect(err?.error.message).to.equal("get_waku_v2_filter_v1_messages raised an exception");
        expect(err?.error.data).to.equal(`Not subscribed to content topic: ${contentTopic}`);
        expect(messages).to.be.empty;
        done();
      });
    }, 200);
  });
  it.only("Gets a single store messages", function(done) {
    this.timeout(10000);
    wakuOne.post(testMessage, contentTopic);
    setTimeout(() => {
      wakuOne.getStoreMessages(contentTopic, (err, messages: WakuMessage[]) => {
        expect(err).to.be.undefined;
        expect(messages.length).to.equal(1);
        expect(messages[0].payload).to.equal(testMessage);
        expect(messages[0].contentTopic).to.equal(contentTopic);
        done();
      });
    }, 1000);
  });
  xit("Gets multiple store messages", function(done) {
    let allMessages: string[] = [];
    this.timeout(10000);
    for (var i = 0; i < 501; i++) {
      allMessages.push(generateRandomBytes32());
      wakuOne.post(allMessages[allMessages.length - 1], contentTopic);
    }
    setTimeout(() => {
      wakuOne.getStoreMessages(contentTopic, (err, messages: WakuMessage[]) => {
        console.log("TEST LENGTH", err, messages.length);
        let receivedMessages = messages.map(m => m.payload);
        expect(err).to.be.undefined;
        expect(messages.length).to.equal(allMessages.length);
        expect(receivedMessages).to.have.members(allMessages);
        done();
      });
    }, 5000);
  });
});
