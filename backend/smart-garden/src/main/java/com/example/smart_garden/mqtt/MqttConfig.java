package com.example.smart_garden.mqtt;

import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.core.MessageProducer;
import org.springframework.integration.mqtt.core.DefaultMqttPahoClientFactory;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.integration.mqtt.outbound.MqttPahoMessageHandler;
import org.springframework.integration.mqtt.support.DefaultPahoMessageConverter;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;

/**
 * Cấu hình MQTT: cleanSession=false, ClientID cố định (2 kết nối: sub + pub để tránh conflict).
 * TLS: cấu hình qua brokerUrl (ssl://) và MqttConnectOptions khi bật.
 */
@Configuration
public class MqttConfig {

    @Bean
    public DefaultMqttPahoClientFactory mqttClientFactory(MqttProperties props) {
        DefaultMqttPahoClientFactory factory = new DefaultMqttPahoClientFactory();
        MqttConnectOptions options = new MqttConnectOptions();
        options.setServerURIs(new String[]{props.getBrokerUrl()});
        if (props.getUsername() != null && !props.getUsername().isBlank()) {
            options.setUserName(props.getUsername());
        }
        if (props.getPassword() != null) {
            options.setPassword(props.getPassword().toCharArray());
        }
        options.setCleanSession(props.isCleanSession());
        options.setConnectionTimeout(props.getConnectionTimeout());
        options.setKeepAliveInterval(props.getKeepAliveInterval());
        options.setAutomaticReconnect(props.isAutomaticReconnect());
        // TLS: khi dùng ssl://, Paho dùng SSL socket; có thể set SSL properties nếu cần
        factory.setConnectionOptions(options);
        return factory;
    }

    @Bean
    public MessageChannel mqttInboundChannel() {
        return new DirectChannel();
    }

    @Bean
    public MessageProducer mqttInbound(MqttProperties props,
                                        DefaultMqttPahoClientFactory factory) {
        MqttPahoMessageDrivenChannelAdapter adapter =
                new MqttPahoMessageDrivenChannelAdapter(
                        props.getBrokerUrl(),
                        props.getClientId(),
                        factory,
                        MqttTopics.SUB_STATUS,
                        MqttTopics.SUB_SENSOR,
                        MqttTopics.SUB_HEARTBEAT,
                        MqttTopics.SUB_LWT,
                        MqttTopics.SUB_CMD_ACK
                );
        adapter.setCompletionTimeout(5000);
        adapter.setConverter(new DefaultPahoMessageConverter());
        adapter.setQos(1);
        adapter.setOutputChannel(mqttInboundChannel());
        return adapter;
    }

    @Bean
    @ServiceActivator(inputChannel = "mqttInboundChannel")
    public MessageHandler mqttInboundChannelHandler(MqttInboundHandler handler) {
        return message -> handler.handle(message);
    }

    @Bean
    public MessageChannel mqttOutboundChannel() {
        return new DirectChannel();
    }

    /** Outbound: clientId riêng để tránh conflict với inbound (cùng broker chỉ cho 1 connection/clientId). */
    @Bean
    @ServiceActivator(inputChannel = "mqttOutboundChannel")
    public MessageHandler mqttOutbound(MqttProperties props,
                                       DefaultMqttPahoClientFactory factory) {
        MqttPahoMessageHandler handler = new MqttPahoMessageHandler(
                props.getClientId() + "-pub",
                factory
        );
        handler.setAsync(true);
        handler.setDefaultQos(1);
        return handler;
    }
}
