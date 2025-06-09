import { RecordId } from "surrealdb";
import * as d3 from "d3";
import { useEffect, useRef } from "react";

type Props = {
    data: {
        entity_data: EntityData[],
        property_data: PropertyData[]
    }
}

export interface EntityData {
    id: RecordId;
    name: string;
    property: {
        id: RecordId,
        prop_name: string
    }[]
}

export interface PropertyData {
    entity: {
        id: RecordId,
        name: string
    }[],
    id: RecordId,
    prop_name: string
}

type Node = {
    id: string;
    name: string;
    type: 'entity' | 'property';
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
};

type Link = {
    source: Node;
    target: Node;
    direction: 'subset' | 'superset'; // 区分连接方向
};

export const GraphViewer = ({ data }: Props) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const simulationRef = useRef<d3.Simulation<Node, Link>>(null);

    useEffect(() => {
        if (!data) return;

        // Prepare nodes and links
        const nodes: Node[] = [];
        const links: Link[] = [];
        
        // Create entity nodes
        data.entity_data.forEach(entity => {
            const entityNode: Node = {
                id: entity.id.toString(),
                name: entity.name,
                type: 'entity'
            };
            nodes.push(entityNode);
            
            // Create property links
            entity.property.forEach(prop => {
                // 先创建临时连接，稍后添加目标节点
                links.push({
                    source: entityNode,
                    target: null as any, // 稍后填充
                    direction: 'subset' // entity->property是subset关系
                });
            });
        });
        
        // Create property nodes
        data.property_data.forEach(prop => {
            const propNode: Node = {
                id: prop.id.toString(),
                name: prop.prop_name,
                type: 'property'
            };
            nodes.push(propNode);
            
            // 更新之前创建的临时连接的目标节点
            links.forEach(link => {
                if (link.target === null && link.source.type === 'entity') {
                    const entityId = link.source.id;
                    const propId = prop.id.toString();
                    
                    // 检查此属性是否属于当前实体
                    const entity = data.entity_data.find(e => e.id.toString() === entityId);
                    if (entity && entity.property.some(p => p.id.toString() === propId)) {
                        link.target = propNode;
                    }
                }
            });
            
            // Create reverse links (property -> entity)
            prop.entity.forEach(entity => {
                const entityNode = nodes.find(n => 
                    n.type === 'entity' && n.id === entity.id.toString()
                );
                if (entityNode) {
                    links.push({
                        source: propNode,
                        target: entityNode,
                        direction: 'superset' // property->entity是superset关系
                    });
                }
            });
        });
        
        // 移除未完成的临时连接
        const validLinks = links.filter(link => link.target !== null);
        links.length = 0;
        links.push(...validLinks);

        // If there are no nodes, exit
        if (nodes.length === 0) return;

        console.log('Generated links:', links);  // 调试输出连接关系
        console.log('Generated nodes:', nodes);  // 调试输出节点

        const svg = d3.select<SVGSVGElement, unknown>(svgRef.current!);
        const width = svgRef.current?.clientWidth || 800;
        const height = svgRef.current?.clientHeight || 600;

        // Clear previous graph
        svg.selectAll("*").remove();

        // Create a container for zooming
        const container = svg.append("g")
            .attr("class", "graph-container");

        // Set up zoom
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 8])
            .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
                container.attr("transform", event.transform.toString());
            });
        svg.call(zoom as any);

        // Set up simulation
        simulationRef.current = d3.forceSimulation(nodes)
            .force("link", d3.forceLink<Node, Link>(links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("radial", d3.forceRadial(width / 3, width / 2, height / 2).strength(0.1));

        // Define arrow markers
        svg.append("defs").selectAll("marker")
            .data(["subset", "superset"])
            .enter()
            .append("marker")
            .attr("id", d => `arrow-${d}`)
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 15)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", d => d === "subset" ? "#69b3a2" : "#ff7f0e");

        // Draw links first (ensure they are below nodes)
        const link = container.append("g")
            .attr("class", "links")
            .attr("stroke", "#4a6bff")
            .attr("stroke-opacity", 0.9)
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke-width", 2)
            .attr("pointer-events", "none") // Allow clicks to pass through
            .attr("marker-end", d => `url(#arrow-${d.direction})`);

        // Draw nodes (on top of links)
        const node = container.append("g")
            .selectAll("circle")
            .data(nodes)
            .join("circle")
            .attr("r", 10)
            .attr("fill", (d) => d.type === 'entity' ? "#69b3a2" : "#ff7f0e")
            .call(d3.drag<SVGCircleElement, Node, Node>()
                .on("start", (event, d) => dragstarted(event, d))
                .on("drag", (event, d) => dragged(event, d))
                .on("end", (event, d) => dragended(event, d)) as any);

        // Add labels
        const label = container.append("g")
            .selectAll("text")
            .data(nodes)
            .join("text")
            .text(d => d.name)
            .attr("font-size", 12)
            .attr("dx", 12)
            .attr("dy", 4);

        // Update position on each tick
        simulationRef.current?.on("tick", () => {
            link
                .attr("x1", d => d.source.x ?? 0)
                .attr("y1", d => d.source.y ?? 0)
                .attr("x2", d => d.target.x ?? 0)
                .attr("y2", d => d.target.y ?? 0);

            node
                .attr("cx", d => d.x ?? 0)
                .attr("cy", d => d.y ?? 0);

            label
                .attr("x", d => d.x ?? 0)
                .attr("y", d => d.y ?? 0);
        });


        // Clean up
        return () => {
            simulationRef.current?.stop();
        };
    }, [data]);

    // Drag functions
    function dragstarted(event: d3.D3DragEvent<SVGCircleElement, Node, Node>, d: Node) {
        if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
        d.fx = d.x ?? 0;
        d.fy = d.y ?? 0;
    }

    function dragged(event: d3.D3DragEvent<SVGCircleElement, Node, Node>, d: Node) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGCircleElement, Node, Node>, d: Node) {
        if (!event.active) simulationRef.current?.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    return (
        <svg 
            ref={svgRef} 
            width="100%" 
            height="600px"
            style={{
                overflow: "visible",
                display: "block",
                backgroundColor: "#f8f9fa"
            }}
        ></svg>
    );
};
