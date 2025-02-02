<!--<script setup lang="ts"></script>-->

<!--<template>-->
<!--  <div-->
<!--    class="q-flex q-relative q-pa-none"-->
<!--    tabindex="1"-->
<!--    ref="annotatorBox"-->
<!--    @mouseover="enterAnnotatorBox"-->
<!--    @mouseleave="leaveAnnotatorBox"-->
<!--    @keydown.exact="handleKeyDownEvent"-->
<!--    v-loading="loading"-->
<!--    element-loading-text="Loading..."-->
<!--  >-->
<!--    <div-->
<!--      class="q-flex q-position-absolute q-z-10"-->
<!--      :style="annotator.innerToolBox.boxStyle"-->
<!--    >-->
<!--      <select :model-value="currentLabel.name" @change="changeAnnotationLabel">-->
<!--        <option-->
<!--          v-for="item in labels"-->
<!--          :key="item.name"-->
<!--          :label="item.name"-->
<!--          :value="item.name"-->
<!--        />-->
<!--      </select>-->
<!--      <el-button-->
<!--        type="danger"-->
<!--        :icon="Delete"-->
<!--        @click="removeAnnotation(annotator.innerToolBox.getMarkboxId())"-->
<!--        circle-->
<!--      ></el-button>-->
<!--    </div>-->
<!--    <v-stage-->
<!--      ref="stage"-->
<!--      :config="annotator.stageConfig"-->
<!--      @mousedown="startResizeAnnotation"-->
<!--    >-->
<!--      <v-layer-->
<!--        :config="annotator.layerConfig"-->
<!--        @mouseleave="leaveAnnotateRange"-->
<!--        @wheel="wheelResizeLayer"-->
<!--        @dragmove="dragLayer"-->
<!--        @mousemove="editAnnotationVolume"-->
<!--        @mouseup="stopEditAnnotationVolume"-->
<!--      >-->
<!--        <v-image-->
<!--          :config="annotator.imageConfig"-->
<!--          @mousedown="createAnnotation"-->
<!--        />-->
<!--        <v-group-->
<!--          v-for="item in annotations"-->
<!--          :key="item.id"-->
<!--          :config="{ name: item.id, visible: true }"-->
<!--        >-->
<!--          <v-rect-->
<!--            :config="{-->
<!--              id: item.id,-->
<!--              x: item.x,-->
<!--              y: item.y,-->
<!--              width: item.width,-->
<!--              height: item.height,-->
<!--              stroke: `${getLabelColor(item.labelName, labels)}`,-->
<!--              draggable: true,-->
<!--            }"-->
<!--            @dragmove="startDragAnnotation"-->
<!--            @dragend="stopDragAnnotation"-->
<!--            @transformend="stopResizeAnnotation"-->
<!--          />-->
<!--          <v-text-->
<!--            :config="{-->
<!--              id: item.id,-->
<!--              text: item.labelName,-->
<!--              x: item.x,-->
<!--              y: item.y - 20 / annotator.layer.scaleX(),-->
<!--              fill: '#fbfbfa',-->
<!--              fontSize: 20 / annotator.layer.scaleX(),-->
<!--              visible: true,-->
<!--            }"-->
<!--          />-->
<!--        </v-group>-->
<!--        <v-transformer :config="annotator.transformerConfig" />-->
<!--      </v-layer>-->
<!--    </v-stage>-->
<!--  </div>-->
<!--</template>-->

<!--<style scoped></style>-->
<template><div>ahoj</div></template>
